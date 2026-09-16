module Purust.RecordScalarization (optimizeRecordLoops) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Foldable (foldMap, foldl)
import Data.Map as Map
import Data.Maybe (Maybe(..))
import Data.Set as Set
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..), fst, snd)
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Ident(..), Literal(..), ModuleName, Prop(..), Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendSyntax(..), Level(..), Pair(..))
import PureScript.Backend.Optimizer.Syntax as Syn
import Purust.RecordScalarCalls (Dependency(..), Summary)
import Purust.RecordScalarCalls as Calls

type Groups = Array (BackendBindingGroup Ident NeutralExpr)
type Ref = Tuple (Maybe Ident) Level
type Path = Array String
type Scalar = { expr :: NeutralExpr, ty :: ExprType }
type RecordState = { values :: Map.Map Path NeutralExpr, written :: Set.Set Path }
type Tail = { expr :: NeutralExpr, written :: Set.Set Path, recursive :: Boolean, base :: Boolean }
type Environment =
  { moduleName :: ModuleName
  , original :: Ident
  , worker :: Ident
  , workerType :: ExprType
  , argTypes :: Array ExprType
  , recordIndex :: Int
  , recordRef :: Ref
  , recordType :: ExprType
  , scalarLocals :: Map.Map Level ExprType
  , fields :: Array { path :: Path, ref :: Ref }
  , changed :: Ref
  , written :: Set.Set Path
  , summaries :: Array Summary
  }

-- A backend worker/wrapper transformation over the final PBO expression.
-- Only closed trees of Int fields and pure scalar operations are accepted.
-- The original record is an immutable reconstruction anchor; its fields stay
-- in native worker arguments across tail calls. Unknown consumers, captures,
-- open rows, recursive local scopes and record aliases keep their old code.
-- No source usage count or heap uniqueness assumption participates here.
optimizeRecordLoops
  :: (String -> String)
  -> Set.Set String
  -> ModuleName
  -> Groups
  -> { bindings :: Groups, workers :: Set.Set Ident }
optimizeRecordLoops sanitize reserved moduleName groups =
  let
    summaries = Calls.summarizeCalls sanitize reserved groups
    helperNames = Set.fromFoldable (Array.concatMap (map _.worker <<< _.fields) summaries)
    names = Set.fromFoldable (Array.concatMap (map fst <<< _.bindings) groups)
      <> Set.map Ident reserved <> helperNames
    result = foldl transform { names, bindings: [], workers: Set.empty } groups
    transform acc group = case group.bindings of
      [ Tuple original expr ] | group.recursive ->
        let worker = freshName sanitize acc.names original 0
        in case recognize summaries moduleName original worker expr of
          Just generated ->
            { names: Set.insert worker acc.names
            , bindings: acc.bindings <>
                [ { recursive: true, bindings: [ Tuple worker generated.worker ] }
                , { recursive: false, bindings: [ Tuple original generated.wrapper ] }
                ]
            , workers: Set.insert worker acc.workers
            }
          Nothing -> acc { bindings = Array.snoc acc.bindings group }
      _ -> acc { bindings = Array.snoc acc.bindings group }
    usedHelpers = foldMap (foldMap (references helperNames <<< snd) <<< _.bindings) result.bindings
    helpers = Array.filter (\group -> Array.any (\(Tuple name _) -> Set.member name usedHelpers) group.bindings)
      (Calls.workerBindings summaries)
  in { bindings: helpers <> result.bindings, workers: result.workers <> usedHelpers }

references :: Set.Set Ident -> NeutralExpr -> Set.Set Ident
references candidates (NeutralExpr syn) = case syn of
  Var (Qualified Nothing name) | Set.member name candidates -> Set.singleton name
  _ -> foldMap (references candidates) syn

freshName :: (String -> String) -> Set.Set Ident -> Ident -> Int -> Ident
freshName sanitize names (Ident original) index =
  let
    candidate = original <> "__purust_record_loop_" <> show index
    emitted = Set.map (\(Ident name) -> sanitize name) names
  in if Set.member (Ident candidate) names || Set.member (sanitize candidate) emitted
    then freshName sanitize names (Ident original) (index + 1)
    else Ident candidate

strip :: NeutralExpr -> BackendSyntax NeutralExpr
strip (NeutralExpr syn) = case syn of
  Typed _ inner -> strip inner
  Syn.TypeApp inner _ -> strip inner
  _ -> syn

annotation :: NeutralExpr -> Maybe ExprType
annotation (NeutralExpr syn) = case syn of
  Typed ty _ -> Just ty
  Syn.TypeApp inner _ -> annotation inner
  _ -> Nothing

typed :: ExprType -> NeutralExpr -> NeutralExpr
typed ty = NeutralExpr <<< Typed ty

local :: ExprType -> Ref -> NeutralExpr
local ty (Tuple ident level) = typed ty (NeutralExpr (Local ident level))

boolean :: Boolean -> NeutralExpr
boolean value = typed Boolean (NeutralExpr (Lit (LitBoolean value)))

arrow :: ExprType -> { args :: Array ExprType, result :: ExprType }
arrow (Func args result) =
  let rest = arrow result
  in { args: args <> rest.args, result: rest.result }
arrow ty = { args: [], result: ty }

abstractions :: NeutralExpr -> { args :: Array Ref, body :: NeutralExpr }
abstractions expr = case strip expr of
  Abs args body ->
    let rest = abstractions body
    in { args: NEA.toArray args <> rest.args, body: rest.body }
  _ -> { args: [], body: expr }

spine :: NeutralExpr -> { head :: NeutralExpr, args :: Array NeutralExpr }
spine = go []
  where
  go args expr = case strip expr of
    App head more -> go (NEA.toArray more <> args) head
    _ -> { head: expr, args }

call :: ModuleName -> Ident -> ExprType -> ExprType -> Array NeutralExpr -> Maybe NeutralExpr
call moduleName name functionType resultType args = do
  nonempty <- NEA.fromArray args
  pure (typed resultType (NeutralExpr (App
    (typed functionType (NeutralExpr (Var (Qualified (Just moduleName) name)))) nonempty)))

-- Bound expansion as well as emitted worker arity. Unsupported shapes simply
-- use the ordinary code generator, including records with opaque leaf types.
leafPaths :: Int -> Path -> ExprType -> Maybe (Array Path)
leafPaths depth path ty
  | depth > 8 = Nothing
  | otherwise = case ty of
      Int -> Just [ path ]
      Record (Row fields Nothing) -> do
        guard (not (Array.null fields))
        guard (Array.length (Array.nub (map fst fields)) == Array.length fields)
        children <- traverse (\(Tuple label child) -> leafPaths (depth + 1) (Array.snoc path label) child) fields
        let leaves = Array.concat children
        guard (Array.length leaves <= 16)
        pure leaves
      _ -> Nothing

maximumLevel :: NeutralExpr -> Int
maximumLevel (NeutralExpr syn) =
  let
    own = case syn of
      Local _ (Level n) -> n
      Let _ (Level n) _ _ -> n
      Abs params _ -> foldl (\acc (Tuple _ (Level n)) -> max acc n) (-1) params
      _ -> -1
  in foldl (\acc expr -> max acc (maximumLevel expr)) own syn

recognize :: Array Summary -> ModuleName -> Ident -> Ident -> NeutralExpr -> Maybe { worker :: NeutralExpr, wrapper :: NeutralExpr }
recognize summaries moduleName original worker expr = do
  originalType <- annotation expr
  let signature = arrow originalType
      lambda = abstractions expr
  guard (not (Array.null lambda.args) && Array.length lambda.args == Array.length signature.args)
  guard (Array.length (Array.nub (map snd lambda.args)) == Array.length lambda.args)
  recordIndex <- case Array.mapMaybe (\(Tuple i ty) -> if ty == signature.result then Just i else Nothing)
      (Array.mapWithIndex Tuple signature.args) of
    [ index ] -> Just index
    _ -> Nothing
  case signature.result of
    Record (Row _ Nothing) -> pure unit
    _ -> Nothing
  paths <- leafPaths 0 [] signature.result
  guard (Array.all (\(Tuple i ty) -> i == recordIndex || ty == Int || ty == Boolean)
    (Array.mapWithIndex Tuple signature.args))
  recordRef <- Array.index lambda.args recordIndex
  parameters <- NEA.fromArray lambda.args
  let
    next = maximumLevel expr + 1
    fields = Array.mapWithIndex (\i path -> { path, ref: Tuple Nothing (Level (next + i)) }) paths
    changed = Tuple Nothing (Level (next + Array.length fields))
    workerType = Func (signature.args <> map (const Int) fields <> [ Boolean ]) signature.result
    scalarLocals = Map.fromFoldable (Array.mapMaybe (\(Tuple i (Tuple _ level)) -> do
      guard (i /= recordIndex)
      ty <- Array.index signature.args i
      pure (Tuple level ty)) (Array.mapWithIndex Tuple lambda.args))
    env = { moduleName, original, worker, workerType, argTypes: signature.args, recordIndex
          , recordRef, recordType: signature.result, scalarLocals, fields, changed, written: Set.empty, summaries }
  proof <- tailTerm env lambda.body
  guard (proof.recursive && proof.base && not (Set.isEmpty proof.written))
  body <- tailTerm (env { written = proof.written }) lambda.body
  workerParams <- NEA.fromArray (lambda.args <> map _.ref fields <> [ changed ])
  initial <- traverse (\field -> projection recordRef signature.result field.path) fields
  wrapperBody <- call moduleName worker workerType signature.result
    (Array.zipWith local signature.args lambda.args <> map (local Int <<< _.ref) fields <> [ boolean false ])
  -- Read fields before moving the anchor. Passing projections as later call
  -- arguments would keep the wrapper's record alive and force a clone for the
  -- worker's earlier anchor argument, defeating unique-input reconstruction.
  let initialized = Array.foldr (\(Tuple field value) continuation ->
        case field.ref of
          Tuple name level -> typed signature.result (NeutralExpr (Let name level value continuation)))
        wrapperBody (Array.zip fields initial)
  pure
    { worker: typed workerType (NeutralExpr (Abs workerParams body.expr))
    , wrapper: typed originalType (NeutralExpr (Abs parameters initialized))
    }

projection :: Ref -> ExprType -> Path -> Maybe NeutralExpr
projection ref ty path = go (local ty ref) ty path
  where
  go base _ [] = Just base
  go base parent labels = do
    { head: label, tail } <- Array.uncons labels
    child <- case parent of
      Record (Row fields Nothing) -> snd <$> Array.find (\(Tuple field _) -> field == label) fields
      _ -> Nothing
    go (typed child (NeutralExpr (Accessor base (GetProp label)))) child tail

projectedPath :: Ref -> ExprType -> NeutralExpr -> Maybe Path
projectedPath ref ty expr = case expr of
  NeutralExpr (Typed annotated inner) -> do
    path <- projectedPath ref ty inner
    projected <- projection ref ty path
    guard (annotation projected == Just annotated)
    pure path
  NeutralExpr (Syn.TypeApp inner _) -> projectedPath ref ty inner
  NeutralExpr (Local _ level) | level == snd ref -> Just []
  NeutralExpr (Accessor base (GetProp label)) -> do
    parent <- projectedPath ref ty base
    let path = Array.snoc parent label
    _ <- projection ref ty path
    pure path
  _ -> Nothing

scalarTerm :: Environment -> NeutralExpr -> Maybe Scalar
scalarTerm env expr = case expr of
  NeutralExpr (Typed ty inner) -> do
    result <- scalarTerm env inner
    guard (result.ty == ty)
    pure result
  NeutralExpr (Syn.TypeApp inner _) -> scalarTerm env inner
  NeutralExpr (Lit value@(LitInt _)) -> Just { expr: typed Int (NeutralExpr (Lit value)), ty: Int }
  NeutralExpr (Lit value@(LitBoolean _)) -> Just { expr: typed Boolean (NeutralExpr (Lit value)), ty: Boolean }
  NeutralExpr (Local ident level) -> do
    ty <- Map.lookup level env.scalarLocals
    pure { expr: local ty (Tuple ident level), ty }
  NeutralExpr (Accessor _ _) -> do
    path <- projectedPath env.recordRef env.recordType expr
    field <- Array.find (\field -> field.path == path) env.fields
    pure { expr: local Int field.ref, ty: Int }
  NeutralExpr (PrimOp (Op1 op value)) -> do
    input <- scalarTerm env value
    ty <- case op of
      OpIntNegate | input.ty == Int -> Just Int
      OpIntBitNot | input.ty == Int -> Just Int
      OpBooleanNot | input.ty == Boolean -> Just Boolean
      _ -> Nothing
    pure { expr: typed ty (NeutralExpr (PrimOp (Op1 op input.expr))), ty }
  NeutralExpr (PrimOp (Op2 op left right)) -> do
    lhs <- scalarTerm env left
    rhs <- scalarTerm env right
    guard (lhs.ty == rhs.ty)
    ty <- case op of
      OpIntNum _ | lhs.ty == Int -> Just Int
      OpIntOrd _ | lhs.ty == Int -> Just Boolean
      OpIntBitAnd | lhs.ty == Int -> Just Int
      OpIntBitOr | lhs.ty == Int -> Just Int
      OpIntBitXor | lhs.ty == Int -> Just Int
      OpIntBitShiftLeft | lhs.ty == Int -> Just Int
      OpIntBitShiftRight | lhs.ty == Int -> Just Int
      OpIntBitZeroFillShiftRight | lhs.ty == Int -> Just Int
      OpBooleanAnd | lhs.ty == Boolean -> Just Boolean
      OpBooleanOr | lhs.ty == Boolean -> Just Boolean
      OpBooleanOrd _ | lhs.ty == Boolean -> Just Boolean
      _ -> Nothing
    pure { expr: typed ty (NeutralExpr (PrimOp (Op2 op lhs.expr rhs.expr))), ty }
  NeutralExpr (Branch branches fallback) -> do
    other <- scalarTerm env fallback
    arms <- traverse (\(Pair condition body) -> do
      test <- scalarTerm env condition
      guard (test.ty == Boolean)
      result <- scalarTerm env body
      guard (result.ty == other.ty)
      pure (Pair test.expr result.expr)) branches
    pure { expr: typed other.ty (NeutralExpr (Branch arms other.expr)), ty: other.ty }
  _ -> Nothing

currentValues :: Environment -> Path -> Map.Map Path NeutralExpr
currentValues env prefix = Map.fromFoldable (Array.mapMaybe (\field -> do
  guard (Array.take (Array.length prefix) field.path == prefix)
  pure (Tuple field.path (local Int field.ref))) env.fields)

-- Every replacement is interpreted against the old iteration's scalar
-- environment. In particular r { a = r.b, b = r.a } is a simultaneous swap.
recordState :: Environment -> Path -> ExprType -> NeutralExpr -> Maybe RecordState
recordState env path ty expr = case expr of
  NeutralExpr (Typed annotated inner) -> do
    guard (annotated == ty)
    recordState env path ty inner
  NeutralExpr (Syn.TypeApp inner _) -> recordState env path ty inner
  NeutralExpr (App _ _) -> do
    applied <- Calls.callSummary env.moduleName env.summaries expr
    guard (applied.summary.recordType == ty)
    recordArg <- Array.index applied.args applied.summary.recordIndex
    -- Keeping the record argument as the current state avoids duplicating any
    -- record-producing computation among the independent field workers.
    guard (projectedPath env.recordRef env.recordType recordArg == Just path)
    args <- traverse (\(Tuple index arg) ->
      if index == applied.summary.recordIndex then pure Nothing
      else do
        scalar <- scalarTerm env arg
        guard (scalar.ty == Int)
        -- Field workers may each use the same parameter. Until we introduce
        -- ordered argument lets, admit only already evaluated scalar values.
        -- A typed record projection becomes such a worker-local scalar too.
        case strip scalar.expr of
          Local _ _ -> pure (Just scalar.expr)
          Lit (LitInt _) -> pure (Just scalar.expr)
          _ -> Nothing) (Array.mapWithIndex Tuple applied.args)
    let values = currentValues env path
        resolve (Parameter index) = Array.index args index >>= identity
        resolve (RecordField relative) = Map.lookup (path <> relative) values
    replacements <- traverse (\field -> do
      value <- Calls.applyFieldWorker field resolve
      pure (Tuple (path <> field.path) value)) applied.summary.fields
    pure
      { values: Map.union (Map.fromFoldable replacements) values
      , written: Set.fromFoldable (map fst replacements)
      }
  NeutralExpr (Update base props) -> do
    guard (projectedPath env.recordRef env.recordType base == Just path)
    fields <- case ty of
      Record (Row fields Nothing) -> Just fields
      _ -> Nothing
    guard (Array.length (Array.nub (map (\(Prop key _) -> key) props)) == Array.length props)
    replacements <- traverse (\(Prop key value) -> do
      Tuple _ childType <- Array.find (\(Tuple label _) -> label == key) fields
      let childPath = Array.snoc path key
      case childType of
        Int -> do
          scalar <- scalarTerm env value
          guard (scalar.ty == Int)
          pure { values: Map.singleton childPath scalar.expr, written: Set.singleton childPath }
        _ -> recordState env childPath childType value) props
    pure
      { values: foldl (\values replacement -> Map.union replacement.values values) (currentValues env path) replacements
      , written: foldMap _.written replacements
      }
  _ -> do
    guard (projectedPath env.recordRef env.recordType expr == Just path)
    pure { values: currentValues env path, written: Set.empty }

reconstruct :: Environment -> Path -> ExprType -> Maybe NeutralExpr
reconstruct env path ty = do
  base <- projection env.recordRef env.recordType path
  case ty of
    Int -> do
      field <- Array.find (\field -> field.path == path) env.fields
      pure (local Int field.ref)
    Record (Row fields Nothing) -> do
      props <- traverse (\(Tuple label child) -> do
        let childPath = Array.snoc path label
        value <- reconstruct env childPath child
        pure (Prop label value)) (Array.filter (\(Tuple label _) ->
          let childPath = Array.snoc path label
          in Array.any (\written -> Array.take (Array.length childPath) written == childPath)
            (Set.toUnfoldable env.written :: Array Path)) fields)
      pure if Array.null props then base else typed ty (NeutralExpr (Update base props))
    _ -> Nothing

tailTerm :: Environment -> NeutralExpr -> Maybe Tail
tailTerm env expr = case expr of
  NeutralExpr (Typed ty inner) -> do
    guard (ty == env.recordType)
    tailTerm env inner
  NeutralExpr (Syn.TypeApp inner _) -> tailTerm env inner
  NeutralExpr (Local _ level) | level == snd env.recordRef -> do
    rebuilt <- reconstruct env [] env.recordType
    arms <- NEA.fromArray [ Pair (local Boolean env.changed) rebuilt ]
    pure { expr: typed env.recordType (NeutralExpr (Branch arms (local env.recordType env.recordRef)))
         , written: Set.empty, recursive: false, base: true }
  NeutralExpr (Let ident level value body) -> do
    scalar <- scalarTerm env value
    -- Levels are lexical identities; accepting a shadow of a worker parameter
    -- would conflate its field provenance with the original record.
    guard (level /= snd env.recordRef && not (Map.member level env.scalarLocals))
    result <- tailTerm (env { scalarLocals = Map.insert level scalar.ty env.scalarLocals }) body
    pure (result { expr = typed env.recordType (NeutralExpr (Let ident level scalar.expr result.expr)) })
  NeutralExpr (Branch branches fallback) -> do
    other <- tailTerm env fallback
    arms <- traverse (\(Pair condition body) -> do
      test <- scalarTerm env condition
      guard (test.ty == Boolean)
      result <- tailTerm env body
      pure { condition: test.expr, result }) branches
    pure
      { expr: typed env.recordType (NeutralExpr (Branch (map (\arm -> Pair arm.condition arm.result.expr) arms) other.expr))
      , written: other.written <> foldMap (_.written <<< _.result) arms
      , recursive: other.recursive || Array.any (_.recursive <<< _.result) (NEA.toArray arms)
      , base: other.base || Array.any (_.base <<< _.result) (NEA.toArray arms)
      }
  NeutralExpr (App _ _) -> do
    let applied = spine expr
    case strip applied.head of
      Var (Qualified owner name)
        | name == env.original && (owner == Nothing || owner == Just env.moduleName) -> pure unit
      _ -> Nothing
    guard (Array.length applied.args == Array.length env.argTypes)
    recordArg <- Array.index applied.args env.recordIndex
    state <- recordState env [] env.recordType recordArg
    args <- traverse (\(Tuple i arg) -> if i == env.recordIndex
      then pure (local env.recordType env.recordRef)
      else do
        scalar <- scalarTerm env arg
        guard (Array.index env.argTypes i == Just scalar.ty)
        pure scalar.expr) (Array.mapWithIndex Tuple applied.args)
    values <- traverse (\field -> Map.lookup field.path state.values) env.fields
    let changed = if Set.isEmpty state.written then local Boolean env.changed else boolean true
    result <- call env.moduleName env.worker env.workerType env.recordType (args <> values <> [ changed ])
    pure { expr: result, written: state.written, recursive: true, base: false }
  _ -> Nothing
