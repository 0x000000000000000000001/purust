module Purust.ListFusion (optimizeListPipelines) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Foldable (foldl, foldr)
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe, isJust)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Ident(..), Literal(..), ModuleName(..), Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendOperatorNum(..), BackendOperatorOrd(..), BackendSyntax(..), Level(..), Pair(..))
import PureScript.Backend.Optimizer.Syntax as Syn

type BindingGroups = Array (BackendBindingGroup Ident NeutralExpr)

type FoldInfo =
  { nilCtor :: Qualified Ident
  , consCtor :: Qualified Ident
  }

type Worker =
  { level :: Level
  , ident :: Ident
  , expr :: NeutralExpr
  }

type Producer =
  { level :: Level
  , curr :: Level
  , acc :: Level
  , start :: NeutralExpr
  }

type Filter =
  { level :: Level
  , xs :: Level
  , acc :: Level
  , predicate :: NeutralExpr
  }

type Pipeline =
  { producer :: Producer
  , filter :: Filter
  , end :: NeutralExpr
  }

data Commutative = Add | Multiply

-- Narrow first scope: a module-local `foldl` over a module-local strict list,
-- applied to `filter p (range lo hi)` after PBO inlined the small list
-- functions as local workers. Element and accumulator must be Int and the
-- callback a commutative Int operation (intAdd/intMul): the producer builds
-- the list in ascending order while a descending loop visits it in the
-- opposite one. Bounds, seed and predicate must be pure stable terms.
-- Anything else keeps the original generic code path.
type Context =
  { moduleName :: ModuleName
  , folds :: Map.Map Ident FoldInfo
  }

optimizeListPipelines :: ModuleName -> BindingGroups -> BindingGroups
optimizeListPipelines moduleName groups =
  let
    folds = Map.fromFoldable (Array.mapMaybe foldEntry groups)
    context = { moduleName, folds }
  in map (rewriteGroup context) groups

foldEntry :: BackendBindingGroup Ident NeutralExpr -> Maybe (Tuple Ident FoldInfo)
foldEntry group = case group.bindings of
  [ Tuple ident expr ] | group.recursive -> do
    info <- recognizeFold ident expr
    pure (Tuple ident info)
  _ -> Nothing

rewriteGroup :: Context -> BackendBindingGroup Ident NeutralExpr -> BackendBindingGroup Ident NeutralExpr
rewriteGroup context group =
  group { bindings = map (\(Tuple ident expr) -> Tuple ident (rewriteExpr context (maxLevel expr) expr)) group.bindings }

-- `baseLevel` is the maximum local level of the whole binding, so the levels
-- introduced by the fused workers never collide with another binder of the
-- enclosing function (nested scopes reuse lower levels freely).
rewriteExpr :: Context -> Int -> NeutralExpr -> NeutralExpr
rewriteExpr context baseLevel expr =
  let children = NeutralExpr (map (rewriteExpr context baseLevel) syn)
  in case rewriteFilterReverse baseLevel children of
       Just rewritten -> rewritten
       Nothing -> case fuseApplication context baseLevel children of
         Just fused -> fused
         Nothing -> children
  where
  syn = case expr of NeutralExpr s -> s

fuseApplication :: Context -> Int -> NeutralExpr -> Maybe NeutralExpr
fuseApplication context baseLevel expr = do
  let applied = spine expr
  info <- calleeFold context.moduleName context.folds applied.head
  guard (Array.length applied.args == 3)
  fArg <- Array.index applied.args 0
  initArg <- Array.index applied.args 1
  pipelineArg <- Array.index applied.args 2
  operation <- commutative fArg
  guard (isIntCallback fArg)
  guard (stableInt initArg)
  pipeline <- matchPipeline info pipelineArg
  buildFused operation pipeline initArg baseLevel

calleeFold :: ModuleName -> Map.Map Ident FoldInfo -> NeutralExpr -> Maybe FoldInfo
calleeFold moduleName folds head = case strip head of
  Var (Qualified owner (Ident name)) -> do
    guard (owner == Just moduleName || owner == Nothing)
    Map.lookup (Ident name) folds
  _ -> Nothing

commutative :: NeutralExpr -> Maybe Commutative
commutative expr = case strip expr of
  Var (Qualified (Just (ModuleName "Data.Semiring")) (Ident "intAdd")) -> Just Add
  Var (Qualified (Just (ModuleName "Data.Semiring")) (Ident "intMul")) -> Just Multiply
  _ -> Nothing

-- The polymorphic fold definition cannot prove Int by itself; the individual
-- instantiation must be exactly Int -> Int -> Int.
isIntCallback :: NeutralExpr -> Boolean
isIntCallback expr = case functionSignature expr of
  Just signature -> case signature.args of
    [ a, b ] -> a == Int && b == Int && signature.result == Int
    _ -> false
  Nothing -> false

-- The producer counts down from `end` while `curr < start` is false, so only
-- literal or local Int terms are accepted for the bounds and the seed; an
-- arbitrary expression would be re-evaluated per iteration.
stableInt :: NeutralExpr -> Boolean
stableInt expr = case strip expr of
  Lit (LitInt _) -> true
  Local _ _ -> annotation expr == Just Int
  _ -> false

matchPipeline :: FoldInfo -> NeutralExpr -> Maybe Pipeline
matchPipeline info expr = do
  let collected = collectWorkers expr
  filterHead <- case strip collected.body of
    App head _ -> Just head
    _ -> Nothing
  filterWorker <- lookupWorker collected.workers filterHead
  filterArgs <- case strip collected.body of
    App _ args -> Just (NEA.toArray args)
    _ -> Nothing
  guard (Array.length filterArgs == 2)
  nilArg <- Array.index filterArgs 1
  guard (isNilCtor info nilArg)
  producerApp <- Array.index filterArgs 0
  producerArgs <- case strip producerApp of
    App _ args -> Just (NEA.toArray args)
    _ -> Nothing
  guard (Array.length producerArgs == 2)
  producerHead <- case strip producerApp of
    App head _ -> Just head
    _ -> Nothing
  producerWorker <- lookupWorker collected.workers producerHead
  guard (producerWorker.level /= filterWorker.level)
  seed <- Array.index producerArgs 1
  guard (isNilCtor info seed)
  end <- Array.index producerArgs 0
  guard (stableInt end)
  producerShape <- matchProducer info producerWorker
  filterShape <- matchFilter info filterWorker
  pure { producer: producerShape, filter: filterShape, end }

collectWorkers :: NeutralExpr -> { workers :: Array Worker, body :: NeutralExpr }
collectWorkers expr = case strip expr of
  LetRec lvl bindings body -> case Array.uncons (NEA.toArray bindings) of
    Just { head: Tuple ident value, tail: [] } ->
      let rest = collectWorkers body
      in { workers: [ { level: lvl, ident, expr: value } ] <> rest.workers, body: rest.body }
    _ -> { workers: [], body: expr }
  _ -> { workers: [], body: expr }

lookupWorker :: Array Worker -> NeutralExpr -> Maybe Worker
lookupWorker workers head = case strip head of
  Local ident lvl -> Array.find (\worker -> worker.level == lvl && (case ident of
    Just name -> name == worker.ident
    Nothing -> true)) workers
  _ -> Nothing

isNilCtor :: FoldInfo -> NeutralExpr -> Boolean
isNilCtor info expr = case strip expr of
  CtorSaturated ctor _ _ _ fields -> ctor == info.nilCtor && Array.null fields
  _ -> false

matchProducer :: FoldInfo -> Worker -> Maybe Producer
matchProducer info worker = do
  let params = abstractions worker.expr
  guard (Array.length params.args == 2)
  curr <- argLevel params.args 0
  acc <- argLevel params.args 1
  branch <- case strip params.body of
    Branch pairs fallback -> case singlePair pairs of
      Just found -> Just { condition: pairFst found, then: pairSnd found, fallback }
      Nothing -> Nothing
    _ -> Nothing
  guard (isLocal acc branch.then)
  start <- matchLt curr branch.condition
  guard (stableInt start)
  case strip branch.fallback of
    App selfHead selfArgs | NEA.length selfArgs == 2 -> do
      guard (isSelf worker selfHead)
      decrement <- Array.index (NEA.toArray selfArgs) 0
      cons <- Array.index (NEA.toArray selfArgs) 1
      guard (isDecrementOf curr decrement)
      guard (isProducerCons info curr acc cons)
      pure { level: worker.level, curr, acc, start }
    _ -> Nothing

matchFilter :: FoldInfo -> Worker -> Maybe Filter
matchFilter info worker = do
  let params = abstractions worker.expr
  guard (Array.length params.args == 2)
  xs <- argLevel params.args 0
  acc <- argLevel params.args 1
  outer <- case strip params.body of
    Branch pairs fallback -> Just { pairs: NEA.toArray pairs, fallback }
    _ -> Nothing
  nilPair <- pairAt outer.pairs 0
  consPair <- pairAt outer.pairs 1
  guard (isNilTest info xs (pairFst nilPair))
  guard (isLocal acc (pairSnd nilPair))
  guard (isConsTest info xs (pairFst consPair))
  inner <- case strip (pairSnd consPair) of
    Branch pairs fallback -> Just { pairs: NEA.toArray pairs, fallback }
    _ -> Nothing
  retained <- pairAt inner.pairs 0
  _ <- case strip (pairSnd retained) of
    App selfHead selfArgs | NEA.length selfArgs == 2 -> do
      guard (isSelf worker selfHead)
      rest <- Array.index (NEA.toArray selfArgs) 0
      cons <- Array.index (NEA.toArray selfArgs) 1
      guard (isFieldAccessor xs 1 rest)
      guard (isFilterCons info xs acc cons)
      pure unit
    _ -> Nothing
  _ <- case strip inner.fallback of
    App selfHead selfArgs | NEA.length selfArgs == 2 -> do
      guard (isSelf worker selfHead)
      rest <- Array.index (NEA.toArray selfArgs) 0
      value <- Array.index (NEA.toArray selfArgs) 1
      guard (isFieldAccessor xs 1 rest)
      guard (isLocal acc value)
      pure unit
    _ -> Nothing
  pure { level: worker.level, xs, acc, predicate: pairFst retained }

matchLt :: Level -> NeutralExpr -> Maybe NeutralExpr
matchLt curr expr = case strip expr of
  PrimOp (Op2 (OpIntOrd OpLt) left right) -> do
    guard (isLocal curr left)
    pure right
  _ -> Nothing

isDecrementOf :: Level -> NeutralExpr -> Boolean
isDecrementOf curr expr = case strip expr of
  PrimOp (Op2 (OpIntNum OpSubtract) left right) -> isLocal curr left && isOne right
  _ -> false

isProducerCons :: FoldInfo -> Level -> Level -> NeutralExpr -> Boolean
isProducerCons info curr acc expr = case strip expr of
  CtorSaturated ctor _ _ _ fields ->
    ctor == info.consCtor && case fields of
      [ Tuple "value0" value0, Tuple "value1" value1 ] -> isLocal curr value0 && isLocal acc value1
      _ -> false
  _ -> false

isFilterCons :: FoldInfo -> Level -> Level -> NeutralExpr -> Boolean
isFilterCons info xs acc expr = case strip expr of
  CtorSaturated ctor _ _ _ fields ->
    ctor == info.consCtor && case fields of
      [ Tuple "value0" value0, Tuple "value1" value1 ] -> isFieldAccessor xs 0 value0 && isLocal acc value1
      _ -> false
  _ -> false

isFieldAccessor :: Level -> Int -> NeutralExpr -> Boolean
isFieldAccessor target index expr = case strip expr of
  Accessor inner (GetCtorField _ _ _ _ _ fieldIndex) ->
    fieldIndex == index && isLocal target inner
  _ -> false

isNilTest :: FoldInfo -> Level -> NeutralExpr -> Boolean
isNilTest info xs expr = case strip expr of
  PrimOp (Op1 (OpIsTag ctor) value) -> ctor == info.nilCtor && isLocal xs value
  _ -> false

isConsTest :: FoldInfo -> Level -> NeutralExpr -> Boolean
isConsTest info xs expr = case strip expr of
  PrimOp (Op1 (OpIsTag ctor) value) -> ctor == info.consCtor && isLocal xs value
  _ -> false

isSelf :: Worker -> NeutralExpr -> Boolean
isSelf worker expr = case strip expr of
  Local ident lvl -> lvl == worker.level && (case ident of
    Just name -> name == worker.ident
    Nothing -> true)
  _ -> false

isLocal :: Level -> NeutralExpr -> Boolean
isLocal lvl expr = case strip expr of
  Local _ other -> other == lvl
  _ -> false

isFail :: NeutralExpr -> Boolean
isFail expr = case strip expr of
  Fail _ -> true
  _ -> false

isOne :: NeutralExpr -> Boolean
isOne expr = case strip expr of
  Lit (LitInt 1) -> true
  _ -> false

pairFst :: forall a. Pair a -> a
pairFst (Pair value _) = value

pairSnd :: forall a. Pair a -> a
pairSnd (Pair _ value) = value

singlePair :: NEA.NonEmptyArray (Pair NeutralExpr) -> Maybe (Pair NeutralExpr)
singlePair pairs = case NEA.toArray pairs of
  [ pair ] -> Just pair
  _ -> Nothing

pairAt :: Array (Pair NeutralExpr) -> Int -> Maybe (Pair NeutralExpr)
pairAt pairs index = Array.index pairs index

argLevel :: Array (Tuple (Maybe Ident) Level) -> Int -> Maybe Level
argLevel args index = map (\(Tuple _ lvl) -> lvl) (Array.index args index)

abstractions :: NeutralExpr -> { args :: Array (Tuple (Maybe Ident) Level), body :: NeutralExpr }
abstractions expr = case strip expr of
  Abs args body ->
    let rest = abstractions body
    in { args: NEA.toArray args <> rest.args, body: rest.body }
  _ -> { args: [], body: expr }

-- `foldl f acc (Cons x xs) = foldl f (f acc x) xs`, with the element read as
-- `value0` and the tail as `value1` of the same constructor.
recognizeFold :: Ident -> NeutralExpr -> Maybe FoldInfo
recognizeFold name expr = do
  let params = abstractions expr
  guard (Array.length params.args == 3)
  f <- argLevel params.args 0
  acc <- argLevel params.args 1
  xs <- argLevel params.args 2
  pairs <- case strip params.body of
    Branch outer fallback -> do
      guard (isFail fallback)
      pure (NEA.toArray outer)
    _ -> Nothing
  nilPair <- pairAt pairs 0
  consPair <- pairAt pairs 1
  nilCtor <- case strip (pairFst nilPair) of
    PrimOp (Op1 (OpIsTag ctor) value) -> do
      guard (isLocal xs value)
      pure ctor
    _ -> Nothing
  guard (isLocal acc (pairSnd nilPair))
  consCtor <- case strip (pairFst consPair) of
    PrimOp (Op1 (OpIsTag ctor) value) -> do
      guard (isLocal xs value)
      pure ctor
    _ -> Nothing
  guard (isFoldStep name f acc xs (pairSnd consPair))
  pure { nilCtor, consCtor }

isFoldStep :: Ident -> Level -> Level -> Level -> NeutralExpr -> Boolean
isFoldStep name f acc xs expr = case strip expr of
  App head args -> case Array.index (NEA.toArray args) 0, Array.index (NEA.toArray args) 1, Array.index (NEA.toArray args) 2 of
    Just fArg, Just callArg, Just restArg ->
      isRecursiveHead name head
        && isLocal f fArg
        && isCallback f acc xs callArg
        && isFieldAccessor xs 1 restArg
    _, _, _ -> false
  _ -> false

isRecursiveHead :: Ident -> NeutralExpr -> Boolean
isRecursiveHead name expr = case strip expr of
  Var (Qualified _ ident) -> ident == name
  _ -> false

isCallback :: Level -> Level -> Level -> NeutralExpr -> Boolean
isCallback f acc xs expr = case strip expr of
  App head args -> case Array.index (NEA.toArray args) 0, Array.index (NEA.toArray args) 1 of
    Just accArg, Just elemArg ->
      isLocal f head && isLocal acc accArg && isFieldAccessor xs 0 elemArg
    _, _ -> false
  _ -> false

-- Replace the filtered element accessor with the fused loop variable. The
-- caller rejects any residual reference to the dropped workers afterwards.
substituteElement :: Level -> NeutralExpr -> NeutralExpr -> NeutralExpr
substituteElement elementLevel replacement = go
  where
  go expr = case strip expr of
    Accessor inner (GetCtorField _ _ _ _ _ index)
      | index == 0 && isLocal elementLevel inner -> replacement
    syn -> NeutralExpr (map go syn)

-- Emit `let go curr acc = if curr < start then acc else go (curr - 1) step`
-- where `step` applies the predicate and the associative Int operation. The
-- loop allocates nothing and keeps the original argument order; rejected
-- levels guarantee the predicate no longer mentions the dropped workers.
buildFused :: Commutative -> Pipeline -> NeutralExpr -> Int -> Maybe NeutralExpr
buildFused operation pipeline initArg maxLvl = do
  let
    workerLevel = Level (maxLvl + 1)
    currLevel = Level (maxLvl + 2)
    accLevel = Level (maxLvl + 3)
    workerIdent = Ident "list_pipeline_worker"
    workerType = Func [ Int, Int ] Int
    curr = typed Int (NeutralExpr (Local Nothing currLevel))
    acc = typed Int (NeutralExpr (Local Nothing accLevel))
    predicate = substituteElement pipeline.filter.xs curr pipeline.filter.predicate
    rejected = [ pipeline.producer.curr, pipeline.producer.acc, pipeline.filter.xs, pipeline.filter.acc ]
  guard (not (Array.any (\lvl -> containsLevel lvl predicate) rejected))
  let
    step = typed Int (NeutralExpr (Branch
      (NEA.singleton (Pair (typed Boolean predicate) (typed Int (arith operation acc curr))))
      acc))
    condition = typed Boolean (NeutralExpr (PrimOp (Op2 (OpIntOrd OpLt) curr pipeline.producer.start)))
    decrement = typed Int (NeutralExpr (PrimOp (Op2 (OpIntNum OpSubtract) curr (intLit 1))))
  loopArgs <- NEA.fromArray [ decrement, step ]
  callArgs <- NEA.fromArray [ pipeline.end, initArg ]
  let
    selfHead = typed workerType (NeutralExpr (Local (Just workerIdent) workerLevel))
    loop = typed Int (NeutralExpr (App selfHead loopArgs))
    body = typed Int (NeutralExpr (Branch (NEA.singleton (Pair condition acc)) loop))
    binding = typed workerType (NeutralExpr (Abs (NEA.singleton (Tuple Nothing currLevel))
      (typed (Func [ Int ] Int) (NeutralExpr (Abs (NEA.singleton (Tuple Nothing accLevel)) body)))))
    workerHead = typed workerType (NeutralExpr (Local (Just workerIdent) workerLevel))
  pure (NeutralExpr (LetRec workerLevel (NEA.singleton (Tuple workerIdent binding))
    (typed Int (NeutralExpr (App workerHead callArgs)))))

arith :: Commutative -> NeutralExpr -> NeutralExpr -> NeutralExpr
arith operation acc curr = NeutralExpr (PrimOp (Op2 op acc curr))
  where
  op = case operation of
    Add -> OpIntNum OpAdd
    Multiply -> OpIntNum OpMultiply

containsLevel :: Level -> NeutralExpr -> Boolean
containsLevel lvl (NeutralExpr syn) = case syn of
  Local _ other -> other == lvl
  _ -> foldl (\found child -> found || containsLevel lvl child) false syn

typed :: ExprType -> NeutralExpr -> NeutralExpr
typed ty expr = NeutralExpr (Typed ty expr)

intLit :: Int -> NeutralExpr
intLit value = typed Int (NeutralExpr (Lit (LitInt value)))

strip :: NeutralExpr -> Syn.BackendSyntax NeutralExpr
strip (NeutralExpr syn) = case syn of
  Typed _ inner -> strip inner
  Syn.TypeApp inner _ -> strip inner
  _ -> syn

annotation :: NeutralExpr -> Maybe ExprType
annotation (NeutralExpr syn) = case syn of
  Typed ty _ -> Just ty
  Syn.TypeApp inner _ -> annotation inner
  _ -> Nothing

-- The outermost usable function signature, unwrapping ForAll and TypeApp.
functionSignature :: NeutralExpr -> Maybe { args :: Array ExprType, result :: ExprType }
functionSignature expr = case Array.mapMaybe (Just <<< arrow <<< unwrapForAll) (collectAnnotations expr) of
  annotations -> Array.find (\signature -> Array.length signature.args >= 2) annotations

collectAnnotations :: NeutralExpr -> Array ExprType
collectAnnotations (NeutralExpr syn) = case syn of
  Typed ty inner -> Array.cons ty (collectAnnotations inner)
  Syn.TypeApp inner _ -> collectAnnotations inner
  _ -> []

unwrapForAll :: ExprType -> ExprType
unwrapForAll ty = case ty of
  ForAll _ inner -> unwrapForAll inner
  _ -> ty

arrow :: ExprType -> { args :: Array ExprType, result :: ExprType }
arrow (Func args result) =
  let rest = arrow result
  in { args: args <> rest.args, result: rest.result }
arrow ty = { args: [], result: ty }

spine :: NeutralExpr -> { head :: NeutralExpr, args :: Array NeutralExpr }
spine = go []
  where
  go args expr = case strip expr of
    App fn more -> go (NEA.toArray more <> args) fn
    _ -> { head: expr, args }

maxLevel :: NeutralExpr -> Int
maxLevel (NeutralExpr syn) = max own child
  where
  own = case syn of
    Local _ (Level lvl) -> lvl
    Let _ (Level lvl) _ _ -> lvl
    LetRec (Level lvl) _ _ -> lvl
    EffectBind _ (Level lvl) _ _ -> lvl
    Abs params _ -> foldl max 0 (map (\(Tuple _ (Level lvl)) -> lvl) (NEA.toArray params))
    UncurriedAbs params _ -> foldl max 0 (map (\(Tuple _ (Level lvl)) -> lvl) params)
    UncurriedEffectAbs params _ -> foldl max 0 (map (\(Tuple _ (Level lvl)) -> lvl) params)
    _ -> 0
  child = foldl (\acc (NeutralExpr childSyn) -> max acc (maxLevel (NeutralExpr childSyn))) 0 syn

-- | A local `filter` whose base branch calls the standard `reverse` on its
-- | accumulator. Rewriting it as a non-tail recursive filter keeps the
-- | element order without materializing the reversed list, so a filtered
-- | list costs one allocation per retained element and a single traversal.
-- | The recursive call lowers to a direct worker `fn` call.
type FilterReverse =
  { level :: Level
  , ident :: Ident
  , xs :: Level
  , acc :: Level
  , listType :: ExprType
  , nilCtor :: Qualified Ident
  , consNode :: NeutralExpr
  , predicate :: NeutralExpr
  , elementAccessor :: NeutralExpr
  , tailAccessor :: NeutralExpr
  }

rewriteFilterReverse :: Int -> NeutralExpr -> Maybe NeutralExpr
rewriteFilterReverse baseLevel expr = case strip expr of
  LetRec lvl bindings body -> do
    Tuple ident worker <- singleBinding (NEA.toArray bindings)
    recognized <- matchFilterReverse lvl ident worker
    let uses = usesOfWorker lvl ident body
    guard (uses.full > 0 && uses.other == 0)
    nilTemplate <- firstNilSeed lvl ident body
    pure (NeutralExpr (LetRec lvl (NEA.singleton (Tuple ident (buildOrderedFilter baseLevel recognized nilTemplate))) body))
  _ -> Nothing

matchFilterReverse :: Level -> Ident -> NeutralExpr -> Maybe FilterReverse
matchFilterReverse lvl ident worker = do
  signature <- functionSignature worker
  listType <- Array.index signature.args 0
  let params = abstractions worker
  guard (Array.length params.args == 2)
  xs <- argLevel params.args 0
  acc <- argLevel params.args 1
  outer <- case strip params.body of
    Branch pairs fallback -> do
      guard (isFail fallback)
      pure (NEA.toArray pairs)
    _ -> Nothing
  guard (Array.length outer == 2)
  nilPair <- pairAt outer 0
  consPair <- pairAt outer 1
  nilCtor <- opIsTagTarget xs (pairFst nilPair)
  _ <- matchReverseBase lvl ident xs acc (pairSnd nilPair)
  consCtor <- opIsTagTarget xs (pairFst consPair)
  inner <- case strip (pairSnd consPair) of
    Branch pairs _ -> Just (NEA.toArray pairs)
    _ -> Nothing
  guard (Array.length inner == 1)
  retained <- pairAt inner 0
  fields <- case strip (pairSnd retained) of
    App selfHead selfArgs | NEA.length selfArgs == 2 -> do
      guard (isLocalOf lvl ident selfHead)
      rest <- Array.index (NEA.toArray selfArgs) 0
      cons <- Array.index (NEA.toArray selfArgs) 1
      guard (isFieldAccessor xs 1 rest)
      case strip cons of
        CtorSaturated ctor _ _ _ [ Tuple "value0" value0, Tuple "value1" value1 ] -> do
          guard (ctor == consCtor)
          guard (isFieldAccessor xs 0 value0)
          guard (isLocal acc value1)
          pure { elementAccessor: value0, tailAccessor: rest, consNode: cons }
        _ -> Nothing
    _ -> Nothing
  pure { level: lvl
       , ident
       , xs
       , acc
       , listType
       , nilCtor
       , consNode: fields.consNode
       , predicate: pairFst retained
       , elementAccessor: fields.elementAccessor
       , tailAccessor: fields.tailAccessor
       }

-- | The base branch calls a local standard `reverse` on the accumulator; the
-- | reverse's seed is `Nil`. Only the inlined local form is accepted.
matchReverseBase :: Level -> Ident -> Level -> Level -> NeutralExpr -> Maybe Unit
matchReverseBase _ _ _ filterAcc expr = case strip expr of
  LetRec revLevel revBindings revBody -> do
    Tuple revIdent revExpr <- singleBinding (NEA.toArray revBindings)
    guard (isReverseWorker revLevel revIdent revExpr)
    applied <- case strip revBody of
      App head args -> Just { head, args: NEA.toArray args }
      _ -> Nothing
    guard (isLocalOf revLevel revIdent applied.head)
    accArg <- Array.index applied.args 0
    seed <- Array.index applied.args 1
    guard (isLocal filterAcc accArg)
    guard (isJust (nilSeedCtor seed))
    pure unit
  _ -> Nothing

isReverseWorker :: Level -> Ident -> NeutralExpr -> Boolean
isReverseWorker lvl ident expr = case abstractions expr of
  { args, body } -> case Array.index args 0, Array.index args 1 of
    Just (Tuple _ xs), Just (Tuple _ acc) -> case strip body of
      Branch pairs fallback -> case NEA.toArray pairs of
        [ nilPair, consPair ] ->
          isFail fallback
            && isJust (opIsTagTarget xs (pairFst nilPair))
            && isLocal acc (pairSnd nilPair)
            && isJust (opIsTagTarget xs (pairFst consPair))
            && case strip (pairSnd consPair) of
              App selfHead selfArgs | NEA.length selfArgs == 2 -> case Array.index (NEA.toArray selfArgs) 0, Array.index (NEA.toArray selfArgs) 1 of
                Just rest, Just cons ->
                  isLocalOf lvl ident selfHead
                    && isFieldAccessor xs 1 rest
                    && case strip cons of
                      CtorSaturated _ _ _ _ [ Tuple "value0" value0, Tuple "value1" value1 ] ->
                        isFieldAccessor xs 0 value0 && isLocal acc value1
                      _ -> false
                _, _ -> false
              _ -> false
        _ -> false
      _ -> false
    _, _ -> false

usesOfWorker :: Level -> Ident -> NeutralExpr -> { full :: Int, other :: Int }
usesOfWorker lvl ident expr = case strip expr of
  App head args ->
    let
      headIsSelf = isLocalOf lvl ident head
      argsArray = NEA.toArray args
      applied = if headIsSelf then case argsArray of
        [ _, seed ] -> if isJust (nilSeedCtor seed)
          then { full: 1, other: 0 }
          else { full: 0, other: 1 }
        _ -> { full: 0, other: 1 }
        else { full: 0, other: 0 }
      headCount = if headIsSelf then { full: 0, other: 0 } else usesOfWorker lvl ident head
      argCounts = map (usesOfWorker lvl ident) argsArray
    in foldl mergeCounts applied (Array.cons headCount argCounts)
  Local _ l -> if l == lvl then { full: 0, other: 1 } else { full: 0, other: 0 }
  syn -> foldl mergeCounts { full: 0, other: 0 } (map (usesOfWorker lvl ident) (childrenArray syn))

mergeCounts :: { full :: Int, other :: Int } -> { full :: Int, other :: Int } -> { full :: Int, other :: Int }
mergeCounts a b = { full: a.full + b.full, other: a.other + b.other }

firstNilSeed :: Level -> Ident -> NeutralExpr -> Maybe NeutralExpr
firstNilSeed lvl ident expr = case strip expr of
  App head args | isLocalOf lvl ident head -> case NEA.toArray args of
    [ _, seed ] -> nilSeedCtor seed *> Just seed
    _ -> Nothing
  syn -> Array.findMap (firstNilSeed lvl ident) (childrenArray syn)

buildOrderedFilter :: Int -> FilterReverse -> NeutralExpr -> NeutralExpr
buildOrderedFilter baseLevel recognized nilTemplate =
  let
    innerLevel = Level (baseLevel + 1)
    xsLevel = Level (baseLevel + 2)
    innerIdent = Ident "list_filter_ordered"
    listTy = recognized.listType
    innerTy = Func [ listTy ] listTy
    outerTy = Func [ listTy, listTy ] listTy
    xs = typed listTy (NeutralExpr (Local Nothing recognized.xs))
    xs1 = typed listTy (NeutralExpr (Local Nothing xsLevel))
    innerHead = typed innerTy (NeutralExpr (Local (Just innerIdent) innerLevel))
    predicate = replaceLocal recognized.xs xsLevel recognized.predicate
    element = replaceLocal recognized.xs xsLevel recognized.elementAccessor
    tailExpr = replaceLocal recognized.xs xsLevel recognized.tailAccessor
    recursiveCall = typed listTy (NeutralExpr (App innerHead (NEA.singleton tailExpr)))
    cons = case strip recognized.consNode of
      CtorSaturated ctor cty tyName consIdent _ ->
        typed listTy (NeutralExpr (CtorSaturated ctor cty tyName consIdent
          [ Tuple "value0" element, Tuple "value1" recursiveCall ]))
      _ -> recursiveCall
    step = typed listTy (NeutralExpr (Branch
      (NEA.singleton (Pair (typed Boolean predicate) cons))
      recursiveCall))
    body = typed listTy (NeutralExpr (Branch
      (NEA.singleton (Pair (typed Boolean (nilTestExpr recognized.nilCtor xs1)) nilTemplate))
      step))
    innerBinding = typed innerTy (NeutralExpr (Abs (NEA.singleton (Tuple Nothing xsLevel)) body))
    outerBody = typed listTy (NeutralExpr (LetRec innerLevel (NEA.singleton (Tuple innerIdent innerBinding))
      (typed listTy (NeutralExpr (App innerHead (NEA.singleton xs))))))
  in typed outerTy (NeutralExpr (Abs (NEA.singleton (Tuple Nothing recognized.xs))
       (typed (Func [ listTy ] listTy) (NeutralExpr (Abs (NEA.singleton (Tuple Nothing recognized.acc)) outerBody)))))

nilTestExpr :: Qualified Ident -> NeutralExpr -> NeutralExpr
nilTestExpr ctor target = NeutralExpr (PrimOp (Op1 (OpIsTag ctor) target))

opIsTagTarget :: Level -> NeutralExpr -> Maybe (Qualified Ident)
opIsTagTarget target expr = case strip expr of
  PrimOp (Op1 (OpIsTag ctor) value) -> do
    guard (isLocal target value)
    pure ctor
  _ -> Nothing

nilSeedCtor :: NeutralExpr -> Maybe (Qualified Ident)
nilSeedCtor expr = case strip expr of
  CtorSaturated ctor _ _ _ [] -> Just ctor
  _ -> Nothing

isLocalOf :: Level -> Ident -> NeutralExpr -> Boolean
isLocalOf lvl ident expr = case strip expr of
  Local mb other -> other == lvl && (case mb of
    Just name -> name == ident
    Nothing -> true)
  _ -> false

replaceLocal :: Level -> Level -> NeutralExpr -> NeutralExpr
replaceLocal from to = go
  where
  go expr = case strip expr of
    Local mb lvl | lvl == from -> NeutralExpr (Typed (fromMaybe Any (annotation expr)) (NeutralExpr (Local mb to)))
    syn -> NeutralExpr (map go syn)

childrenArray :: forall a. Syn.BackendSyntax a -> Array a
childrenArray = foldr Array.cons []

singleBinding :: Array (Tuple Ident NeutralExpr) -> Maybe (Tuple Ident NeutralExpr)
singleBinding bindings = case bindings of
  [ binding ] -> Just binding
  _ -> Nothing
