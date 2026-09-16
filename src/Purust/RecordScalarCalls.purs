module Purust.RecordScalarCalls
  ( Dependency(..)
  , FieldWorker
  , Summary
  , summarizeCalls
  , callSummary
  , workerBindings
  , applyFieldWorker
  ) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Foldable (foldl)
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Set as Set
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..), fst)
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(Int, Func, Record, Row), Ident(..), Literal(..), ModuleName, Prop(..), Qualified(..), findProp)
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendOperatorNum(..), BackendSyntax(..), Level(..))
import PureScript.Backend.Optimizer.Syntax as Syn

-- The calls remain real calls in the optimized IR. A separate scalar worker
-- avoids changing either the public record ABI or PBO's expression language.
-- Only bounded, straight-line helpers are considered, so splitting their
-- outputs cannot duplicate an opaque call, an effect or a recursive computation.
data Dependency = Parameter Int | RecordField (Array String)

derive instance Eq Dependency
derive instance Ord Dependency

type FieldWorker =
  { path :: Array String
  , worker :: Ident
  , dependencies :: Array Dependency
  , binding :: Tuple Ident NeutralExpr
  }

type Summary =
  { original :: Ident
  , arity :: Int
  , recordIndex :: Int
  , recordType :: ExprType
  , fields :: Array FieldWorker
  }

type BindingGroups = Array (BackendBindingGroup Ident NeutralExpr)
type LocalRef = Tuple (Maybe Ident) Level
type Prefix = { ident :: Maybe Ident, level :: Level, value :: NeutralExpr }
type Leaf = { path :: Array String, value :: NeutralExpr, written :: Boolean }
type Environment =
  { recordLevel :: Level
  , recordType :: ExprType
  , leaves :: Array (Array String)
  , parameters :: Map.Map Level Int
  , locals :: Set.Set Level
  }

summarizeCalls
  :: (String -> String)
  -> Set.Set String
  -> BindingGroups
  -> Array Summary
summarizeCalls sanitize reserved groups =
  let
    initial = Set.union reserved (Set.fromFoldable
      (Array.concatMap (map (\(Tuple (Ident name) _) -> sanitize name) <<< _.bindings) groups))
    found = foldl collect { names: initial, summaries: [] } groups
    collect acc group
      | group.recursive = acc
      | otherwise = foldl (collectBinding sanitize) acc group.bindings
  in found.summaries

collectBinding
  :: (String -> String)
  -> { names :: Set.Set String, summaries :: Array Summary }
  -> Tuple Ident NeutralExpr
  -> { names :: Set.Set String, summaries :: Array Summary }
collectBinding sanitize acc (Tuple original expr) = case recognize original expr of
  Nothing -> acc
  Just found ->
    let
      generated = foldl (makeWorker sanitize original found) { names: acc.names, fields: [] } found.outputs
      summary =
        { original, arity: found.arity, recordIndex: found.recordIndex
        , recordType: found.recordType, fields: generated.fields }
    in { names: generated.names, summaries: Array.snoc acc.summaries summary }

type Recognized =
  { arity :: Int
  , recordIndex :: Int
  , recordType :: ExprType
  , environment :: Environment
  , prefix :: Array Prefix
  , outputs :: Array Leaf
  , freshLevel :: Int
  }

recognize :: Ident -> NeutralExpr -> Maybe Recognized
recognize _ expr = do
  ty <- annotation expr
  let signature = arrow ty
      lambda = abstractions expr
  guard (Array.length signature.args == Array.length lambda.args)
  guard (Array.length signature.args <= 12)
  guard (Set.size (Set.fromFoldable (map (\(Tuple _ level) -> level) lambda.args)) == Array.length lambda.args)
  recordIndex <- Array.findIndex (_ /= Int) signature.args
  recordType <- Array.index signature.args recordIndex
  guard (signature.result == recordType)
  guard (Array.all identity (Array.mapWithIndex (\i arg -> i == recordIndex || arg == Int) signature.args))
  leaves <- recordLeaves [] recordType
  guard (not (Array.null leaves) && Array.length leaves <= 12)
  Tuple _ recordLevel <- Array.index lambda.args recordIndex
  let
    parameters = Map.fromFoldable (Array.mapMaybe identity
      (Array.mapWithIndex (\index (Tuple _ level) ->
        if index == recordIndex then Nothing else Just (Tuple level index)) lambda.args))
    environment = { recordLevel, recordType, leaves, parameters, locals: Map.keys parameters }
  prefix <- prefixes environment [] lambda.body
  outputs <- recordOutputs prefix.environment [] recordType prefix.body
  let written = Array.filter _.written outputs
  guard (not (Array.null written))
  -- This is a code-size bound, including duplicated strict let prefixes.
  guard (Array.length written * nodeCount lambda.body <= 256)
  pure
    { arity: Array.length signature.args, recordIndex, recordType
    , environment: prefix.environment, prefix: prefix.prefix, outputs: written
    , freshLevel: maxLevel expr + 1 }

strip :: NeutralExpr -> BackendSyntax NeutralExpr
strip (NeutralExpr syntax) = case syntax of
  Typed _ inner -> strip inner
  Syn.TypeApp inner _ -> strip inner
  _ -> syntax

annotation :: NeutralExpr -> Maybe ExprType
annotation (NeutralExpr syntax) = case syntax of
  Typed ty _ -> Just ty
  Syn.TypeApp inner _ -> annotation inner
  _ -> Nothing

arrow :: ExprType -> { args :: Array ExprType, result :: ExprType }
arrow (Func args result) = let rest = arrow result in { args: args <> rest.args, result: rest.result }
arrow ty = { args: [], result: ty }

abstractions :: NeutralExpr -> { args :: Array LocalRef, body :: NeutralExpr }
abstractions expr = case strip expr of
  Abs args body -> let rest = abstractions body in { args: NEA.toArray args <> rest.args, body: rest.body }
  _ -> { args: [], body: expr }

recordLeaves :: Array String -> ExprType -> Maybe (Array (Array String))
recordLeaves path Int = do
  guard (Array.length path <= 8)
  pure [ path ]
recordLeaves path (Record (Row fields Nothing)) = do
  guard (Array.length path <= 8 && not (Array.null fields))
  guard (Set.size (Set.fromFoldable (map fst fields)) == Array.length fields)
  map Array.concat (traverse (\(Tuple key ty) -> recordLeaves (Array.snoc path key) ty) fields)
recordLeaves _ _ = Nothing

projection :: NeutralExpr -> Maybe { level :: Level, path :: Array String }
projection expr = case strip expr of
  Local _ level -> Just { level, path: [] }
  Accessor parent (GetProp field) -> do
    base <- projection parent
    pure (base { path = Array.snoc base.path field })
  _ -> Nothing

scalar :: Environment -> NeutralExpr -> Boolean
scalar env expr@(NeutralExpr syntax) = case syntax of
  Typed ty inner -> ty == Int && scalar env inner
  Syn.TypeApp inner _ -> scalar env inner
  _ -> case checkedProjection env expr of
    Just ref | ref.level == env.recordLevel -> Array.elem ref.path env.leaves
    _ -> case syntax of
      Local _ level -> Set.member level env.locals
      Lit (LitInt _) -> true
      PrimOp (Op1 OpIntBitNot value) -> scalar env value
      PrimOp (Op2 op left right) -> scalarOperator op && scalar env left && scalar env right
      _ -> false

checkedProjection :: Environment -> NeutralExpr -> Maybe { level :: Level, path :: Array String }
checkedProjection env (NeutralExpr syntax) = case syntax of
  Typed ty inner -> do
    ref <- checkedProjection env inner
    actual <- pathType env.recordType ref.path
    guard (ty == actual)
    pure ref
  Syn.TypeApp inner _ -> checkedProjection env inner
  Local _ level | level == env.recordLevel -> Just { level, path: [] }
  Accessor parent (GetProp field) -> do
    ref <- checkedProjection env parent
    let path = Array.snoc ref.path field
    _ <- pathType env.recordType path
    pure (ref { path = path })
  _ -> Nothing

pathType :: ExprType -> Array String -> Maybe ExprType
pathType ty [] = Just ty
pathType (Record (Row fields Nothing)) path = do
  { head, tail } <- Array.uncons path
  Tuple _ ty <- Array.find (\(Tuple key _) -> key == head) fields
  pathType ty tail
pathType _ _ = Nothing

scalarOperator :: BackendOperator2 -> Boolean
scalarOperator = case _ of
  OpIntNum OpAdd -> true
  OpIntNum OpSubtract -> true
  OpIntNum OpMultiply -> true
  OpIntNum OpMod -> true
  OpIntBitAnd -> true
  OpIntBitOr -> true
  OpIntBitXor -> true
  _ -> false

prefixes
  :: Environment
  -> Array Prefix
  -> NeutralExpr
  -> Maybe { environment :: Environment, prefix :: Array Prefix, body :: NeutralExpr }
prefixes env prefix (NeutralExpr (Typed ty inner)) = do
  guard (ty == env.recordType)
  prefixes env prefix inner
prefixes env prefix (NeutralExpr (Syn.TypeApp inner _)) = prefixes env prefix inner
prefixes env prefix expr = case strip expr of
  Let ident level value body -> do
    guard (scalar env value)
    guard (level /= env.recordLevel && not (Set.member level env.locals))
    prefixes (env { locals = Set.insert level env.locals }) (Array.snoc prefix { ident, level, value }) body
  _ -> Just { environment: env, prefix, body: expr }

recordOutputs :: Environment -> Array String -> ExprType -> NeutralExpr -> Maybe (Array Leaf)
recordOutputs env path ty (NeutralExpr (Typed annotated inner)) = do
  guard (annotated == ty)
  recordOutputs env path ty inner
recordOutputs env path ty (NeutralExpr (Syn.TypeApp inner _)) = recordOutputs env path ty inner
recordOutputs env path ty@(Record (Row fields Nothing)) expr = case strip expr of
  Update base updates -> do
    ref <- checkedProjection env base
    guard (ref.level == env.recordLevel && ref.path == path)
    guard (Set.size (Set.fromFoldable (map (\(Prop key _) -> key) updates)) == Array.length updates)
    guard (Array.all (\(Prop key _) -> Array.any (\(Tuple known _) -> key == known) fields) updates)
    map Array.concat $ traverse (\(Tuple key fieldType) ->
      let childPath = Array.snoc path key
      in case findProp key updates of
        Just value | fieldType == Int -> do
          guard (scalar env value)
          pure [ { path: childPath, value, written: true } ]
        Just value -> recordOutputs env childPath fieldType value
        Nothing -> unchanged env childPath fieldType) fields
  _ -> do
    ref <- checkedProjection env expr
    guard (ref.level == env.recordLevel && ref.path == path)
    unchanged env path ty
recordOutputs _ _ _ _ = Nothing

unchanged :: Environment -> Array String -> ExprType -> Maybe (Array Leaf)
unchanged env path ty = do
  leaves <- recordLeaves path ty
  pure (map (\leaf -> { path: leaf, value: project env.recordLevel leaf, written: false }) leaves)

project :: Level -> Array String -> NeutralExpr
project level = foldl (\base key -> NeutralExpr (Accessor base (GetProp key))) (NeutralExpr (Local Nothing level))

dependencies :: Environment -> NeutralExpr -> Set.Set Dependency
dependencies env expr@(NeutralExpr syntax) = case projection expr of
  Just ref | ref.level == env.recordLevel -> Set.singleton (RecordField ref.path)
  _ -> case syntax of
    Local _ level -> case Map.lookup level env.parameters of
      Just index -> Set.singleton (Parameter index)
      Nothing -> Set.empty
    _ -> foldl (\acc child -> Set.union acc (dependencies env child)) Set.empty syntax

makeWorker
  :: (String -> String)
  -> Ident
  -> Recognized
  -> { names :: Set.Set String, fields :: Array FieldWorker }
  -> Leaf
  -> { names :: Set.Set String, fields :: Array FieldWorker }
makeWorker sanitize original found acc leaf =
  let
    worker = freshWorker sanitize acc.names original (Array.length acc.fields) 0
    prefixDependencies = foldl (\collected entry -> Set.union collected (dependencies found.environment entry.value)) Set.empty found.prefix
    needed = Set.union prefixDependencies (dependencies found.environment leaf.value)
    -- A constant field still gets one scalar parameter, keeping the worker a
    -- direct ordinary function rather than a shared zero-arity module value.
    deps = if Set.isEmpty needed then [ RecordField (fromMaybe [] (Array.head found.environment.leaves)) ]
      else Array.fromFoldable needed
    refs = Array.mapWithIndex (\index _ -> Tuple (Just (Ident ("__purust_field_arg_" <> show index))) (Level (found.freshLevel + index))) deps
    lookup = Map.fromFoldable (Array.zip deps refs)
    rewrite expr@(NeutralExpr syntax) = case projection expr of
      Just ref | ref.level == found.environment.recordLevel -> replace (RecordField ref.path) expr
      _ -> case syntax of
        Local _ level -> case Map.lookup level found.environment.parameters of
          Just index -> replace (Parameter index) expr
          Nothing -> expr
        _ -> NeutralExpr (map rewrite syntax)
    replace dep fallback = case Map.lookup dep lookup of
      Just (Tuple name level) -> NeutralExpr (Typed Int (NeutralExpr (Local name level)))
      Nothing -> fallback
    body = Array.foldr (\entry inner -> NeutralExpr (Let entry.ident entry.level (rewrite entry.value) inner))
      (NeutralExpr (Typed Int (rewrite leaf.value))) found.prefix
    ty = Func (Array.replicate (Array.length deps) Int) Int
    binding = case NEA.fromArray refs of
      Just params -> NeutralExpr (Typed ty (NeutralExpr (Abs params body)))
      Nothing -> body
    field = { path: leaf.path, worker, dependencies: deps, binding: Tuple worker binding }
  in { names: Set.insert (sanitizeIdent worker) acc.names, fields: Array.snoc acc.fields field }
  where
  sanitizeIdent (Ident name) = sanitize name

freshWorker :: (String -> String) -> Set.Set String -> Ident -> Int -> Int -> Ident
freshWorker sanitize names (Ident original) field suffix =
  let candidate = original <> "__purust_record_field_" <> show field <> "_" <> show suffix
  in if Set.member (sanitize candidate) names then freshWorker sanitize names (Ident original) field (suffix + 1)
     else Ident candidate

nodeCount :: NeutralExpr -> Int
nodeCount (NeutralExpr syntax) = 1 + foldl (\count child -> count + nodeCount child) 0 syntax

maxLevel :: NeutralExpr -> Int
maxLevel (NeutralExpr syntax) =
  let children = foldl (\maximum child -> max maximum (maxLevel child)) (-1) syntax
      local = case syntax of
        Local _ (Level level) -> level
        Abs args _ -> foldl (\maximum (Tuple _ (Level level)) -> max maximum level) (-1) args
        Let _ (Level level) _ _ -> level
        _ -> -1
  in max children local

callSummary :: ModuleName -> Array Summary -> NeutralExpr -> Maybe { summary :: Summary, args :: Array NeutralExpr }
callSummary moduleName summaries expr = do
  let applied = spine [] expr
  original <- case strip applied.head of
    Var (Qualified qualifier ident) | qualifier == Nothing || qualifier == Just moduleName -> Just ident
    _ -> Nothing
  summary <- Array.find (\item -> item.original == original && item.arity == Array.length applied.args) summaries
  pure { summary, args: applied.args }
  where
  spine args value = case strip value of
    App fn more -> spine (NEA.toArray more <> args) fn
    _ -> { head: value, args }

workerBindings :: Array Summary -> BindingGroups
workerBindings summaries = map (\field -> { recursive: false, bindings: [ field.binding ] })
  (Array.concatMap _.fields summaries)

applyFieldWorker :: FieldWorker -> (Dependency -> Maybe NeutralExpr) -> Maybe NeutralExpr
applyFieldWorker field resolve = do
  args <- traverse resolve field.dependencies
  nonEmpty <- NEA.fromArray args
  let ty = Func (Array.replicate (Array.length args) Int) Int
      head = NeutralExpr (Typed ty (NeutralExpr (Var (Qualified Nothing field.worker))))
  pure (NeutralExpr (Typed Int (NeutralExpr (App head nonEmpty))))
