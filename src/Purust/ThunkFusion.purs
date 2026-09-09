module Purust.ThunkFusion (optimizeThunkProducers) where

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
import Data.Int as Int
import Data.Int.Bits as Bits
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Ident(..), Literal(..), ModuleName(..), Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendOperatorNum(..), BackendSyntax(Var, Local, Lit, App, Abs, Branch, PrimOp, PrimUndefined, Typed), Level, Pair(..))
import PureScript.Backend.Optimizer.Syntax as Syn

type LocalRef = Tuple (Maybe Ident) Level

type Producer =
  { original :: Ident
  , worker :: Ident
  , arity :: Int
  , thunkIndex :: Int
  , workerType :: ExprType
  , binding :: NeutralExpr
  }

type ProducerEnv =
  { moduleName :: ModuleName
  , original :: Ident
  , worker :: Ident
  , arity :: Int
  , thunkIndex :: Int
  , thunkRef :: LocalRef
  , intLocals :: Set.Set Level
  , workerType :: ExprType
  }

type IntTerm = { expr :: NeutralExpr, demands :: Int }
type TailTerm = { expr :: NeutralExpr, hasBase :: Boolean, hasRecursion :: Boolean }
type Rewritten = { expr :: NeutralExpr, used :: Set.Set Ident }
type BindingGroups = Array (BackendBindingGroup Ident NeutralExpr)

-- Adapted from Gopurs.ThunkFusion. Run after PBO has erased newtypes and
-- inlined wrappers, before Rust local naming and tail-call generation.
-- Retain the original producer. This first Rust scope accepts only closed Int
-- inputs whose strict execution terminates within a bounded proof and stays
-- inside the PureScript Int range. Thus moving arithmetic out of the thunks
-- introduces no overflow panic, even with Rust overflow checks enabled.
optimizeThunkProducers
  :: (String -> String)
  -> Set.Set String
  -> ModuleName
  -> BindingGroups
  -> { bindings :: BindingGroups, workers :: Set.Set Ident }
optimizeThunkProducers sanitizeName reserved moduleName groups =
  let
    initialNames = Set.fromFoldable
      (Array.concatMap (map fst <<< _.bindings) groups)
      <> Set.map Ident reserved
    found = foldl (collectProducer sanitizeName moduleName)
      { names: initialNames, producers: [] } groups
    producers = found.producers
  in if Array.null producers then { bindings: groups, workers: Set.empty }
     else rewriteModule moduleName producers groups

rewriteModule :: ModuleName -> Array Producer -> BindingGroups -> { bindings :: BindingGroups, workers :: Set.Set Ident }
rewriteModule moduleName producers groups =
  let
    byName = Map.fromFoldable (map (\p -> Tuple p.original p) producers)
    rewritten = map
      (\group -> group { bindings = map (\(Tuple ident expr) ->
        Tuple ident (rewriteConsumers moduleName byName expr)) group.bindings })
      groups
    used = foldMap (foldMap (_.used <<< snd) <<< _.bindings) rewritten
    workers = Array.mapMaybe (\p -> do
      guard (Set.member p.worker used)
      pure { recursive: true, bindings: [ Tuple p.worker p.binding ] }) producers
    originals = map (\group -> group { bindings = map (\(Tuple ident result) ->
      Tuple ident result.expr) group.bindings }) rewritten
  -- Workers only depend on their own arguments/recursion. Emit them first so
  -- their arities are available even to an earlier original declaration.
  in { bindings: workers <> originals, workers: used }

collectProducer
  :: (String -> String)
  -> ModuleName
  -> { names :: Set.Set Ident, producers :: Array Producer }
  -> BackendBindingGroup Ident NeutralExpr
  -> { names :: Set.Set Ident, producers :: Array Producer }
collectProducer sanitizeName moduleName acc group = case group.bindings of
  [ Tuple ident expr ] | group.recursive ->
    let worker = freshWorker sanitizeName acc.names ident 0
    in case recognizeProducer moduleName ident worker expr of
      Just p -> { names: Set.insert worker acc.names, producers: Array.snoc acc.producers p }
      Nothing -> acc
  _ -> acc

freshWorker :: (String -> String) -> Set.Set Ident -> Ident -> Int -> Ident
freshWorker sanitizeName names (Ident original) index =
  let
    candidateName = original <> "__purust_strict_thunk_" <> show index
    candidate = Ident candidateName
    emittedNames = Set.map (\(Ident name) -> sanitizeName name) names
  in if Set.member candidate names || Set.member (sanitizeName candidateName) emittedNames
     then freshWorker sanitizeName names (Ident original) (index + 1)
     else candidate

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

arrow :: ExprType -> { args :: Array ExprType, result :: ExprType }
arrow (Func args result) =
  let rest = arrow result
  in { args: args <> rest.args, result: rest.result }
arrow ty = { args: [], result: ty }

intThunk :: ExprType -> Boolean
intThunk ty = case arrow ty of
  { args: [ Unit ], result: Int } -> true
  _ -> false

abstractions :: NeutralExpr -> { args :: Array LocalRef, body :: NeutralExpr }
abstractions expr = case strip expr of
  Abs args body ->
    let rest = abstractions body
    in { args: NEA.toArray args <> rest.args, body: rest.body }
  _ -> { args: [], body: expr }

spine :: NeutralExpr -> { head :: NeutralExpr, args :: Array NeutralExpr }
spine = go []
  where
  go args expr = case strip expr of
    App fn more -> go (NEA.toArray more <> args) fn
    _ -> { head: expr, args }

typedInt :: NeutralExpr -> NeutralExpr
typedInt = NeutralExpr <<< Typed Int

call :: Qualified Ident -> ExprType -> Array NeutralExpr -> Maybe NeutralExpr
call name ty args = do
  ne <- NEA.fromArray args
  pure (typedInt (NeutralExpr (App (NeutralExpr (Typed ty (NeutralExpr (Var name)))) ne)))

isUnit :: NeutralExpr -> Boolean
isUnit expr = case strip expr of
  Var (Qualified (Just (ModuleName "Data.Unit")) (Ident "unit")) -> true
  PrimUndefined -> annotation expr == Just Unit
  _ -> false

containsLocal :: Level -> NeutralExpr -> Boolean
containsLocal level (NeutralExpr syn) = case syn of
  Local _ other -> level == other
  _ -> foldl (\found child -> found || containsLocal level child) false syn

-- A deliberately small total/pure whitelist. In particular division, indexing,
-- boolean short-circuiting, function calls and branches are not integer terms.
integerTerm :: Set.Set Level -> Maybe LocalRef -> NeutralExpr -> Maybe IntTerm
integerTerm locals thunk expr = case strip expr of
  Lit (LitInt value) -> pure { expr: typedInt (NeutralExpr (Lit (LitInt value))), demands: 0 }
  Local ident level -> do
    guard (Set.member level locals || annotation expr == Just Int)
    guard (case thunk of
      Just (Tuple _ thunkLevel) -> level /= thunkLevel
      Nothing -> true)
    pure { expr: typedInt (NeutralExpr (Local ident level)), demands: 0 }
  PrimOp (Op1 op value) | op == OpIntNegate || op == OpIntBitNot -> do
    result <- integerTerm locals thunk value
    pure { expr: typedInt (NeutralExpr (PrimOp (Op1 op result.expr))), demands: result.demands }
  PrimOp (Op2 op left right) | totalIntOperator op -> do
    left' <- integerTerm locals thunk left
    right' <- integerTerm locals thunk right
    pure
      { expr: typedInt (NeutralExpr (PrimOp (Op2 op left'.expr right'.expr)))
      , demands: left'.demands + right'.demands
      }
  App _ _ -> do
    Tuple ident level <- thunk
    let applied = spine expr
    case strip applied.head, applied.args of
      Local _ actualLevel, [ unitArg ] | actualLevel == level && isUnit unitArg ->
        pure { expr: typedInt (NeutralExpr (Local ident level)), demands: 1 }
      _, _ -> Nothing
  _ -> Nothing

totalIntOperator :: BackendOperator2 -> Boolean
totalIntOperator = case _ of
  OpIntNum OpAdd -> true
  OpIntNum OpSubtract -> true
  OpIntNum OpMultiply -> true
  OpIntBitAnd -> true
  OpIntBitOr -> true
  OpIntBitXor -> true
  _ -> false

booleanTerm :: Set.Set Level -> NeutralExpr -> Maybe NeutralExpr
booleanTerm locals expr = case strip expr of
  Lit (LitBoolean value) -> pure (NeutralExpr (Typed Boolean (NeutralExpr (Lit (LitBoolean value)))))
  PrimOp (Op1 OpBooleanNot value) -> do
    value' <- booleanTerm locals value
    pure (NeutralExpr (Typed Boolean (NeutralExpr (PrimOp (Op1 OpBooleanNot value')))))
  PrimOp (Op2 op@(OpIntOrd _) left right) -> do
    left' <- integerTerm locals Nothing left
    right' <- integerTerm locals Nothing right
    pure (NeutralExpr (Typed Boolean (NeutralExpr (PrimOp (Op2 op left'.expr right'.expr)))))
  _ -> Nothing

recognizeProducer :: ModuleName -> Ident -> Ident -> NeutralExpr -> Maybe Producer
recognizeProducer moduleName original worker expr = do
  ty <- annotation expr
  let
    signature = arrow ty
    lambda = abstractions expr
    arity = Array.length lambda.args
    argTypes = Array.take arity signature.args
    thunkIndices = Array.mapMaybe (\(Tuple i t) -> if intThunk t then Just i else Nothing)
      (Array.mapWithIndex Tuple argTypes)
  guard (arity > 0 && Array.drop arity signature.args == [ Unit ] && signature.result == Int)
  thunkIndex <- case thunkIndices of
    [ index ] -> Just index
    _ -> Nothing
  guard (Array.all (\(Tuple i t) -> i == thunkIndex || t == Int) (Array.mapWithIndex Tuple argTypes))
  thunkRef <- Array.index lambda.args thunkIndex
  args <- NEA.fromArray lambda.args
  let
    workerType = Func (map (const Int) lambda.args) Int
    intLocals = Set.fromFoldable (Array.mapMaybe (\(Tuple i (Tuple _ level)) ->
      if i == thunkIndex then Nothing else Just level) (Array.mapWithIndex Tuple lambda.args))
    env = { moduleName, original, worker, arity, thunkIndex, thunkRef, intLocals, workerType }
  body <- producerTail env lambda.body
  guard (body.hasBase && body.hasRecursion)
  pure
    { original, worker, arity, thunkIndex, workerType
    , binding: NeutralExpr (Typed workerType (NeutralExpr (Abs args body.expr)))
    }

producerTail :: ProducerEnv -> NeutralExpr -> Maybe TailTerm
producerTail env expr = case strip expr of
  Local ident level | level == snd env.thunkRef ->
    pure { expr: typedInt (NeutralExpr (Local ident level)), hasBase: true, hasRecursion: false }
  Branch branches fallback -> do
    branches' <- traverse (\(Pair condition body) -> do
      guard (not (containsLocal (snd env.thunkRef) condition))
      condition' <- booleanTerm env.intLocals condition
      body' <- producerTail env body
      pure { condition: condition', body: body' }) branches
    fallback' <- producerTail env fallback
    pure
      { expr: typedInt (NeutralExpr (Branch (map (\b -> Pair b.condition b.body.expr) branches') fallback'.expr))
      , hasBase: fallback'.hasBase || foldl (\yes b -> yes || b.body.hasBase) false branches'
      , hasRecursion: fallback'.hasRecursion || foldl (\yes b -> yes || b.body.hasRecursion) false branches'
      }
  App _ _ -> do
    let applied = spine expr
    guard (Array.length applied.args == env.arity)
    case strip applied.head of
      Var (Qualified (Just moduleName) ident) | moduleName == env.moduleName && ident == env.original -> pure unit
      _ -> Nothing
    args <- traverse (\(Tuple index arg) ->
      if index == env.thunkIndex then do
        let lambda = abstractions arg
        guard (case annotation arg of
          Just ty -> intThunk ty
          Nothing -> false)
        case lambda.args of
          [ Tuple _ unitLevel ] -> do
            guard (not (containsLocal unitLevel lambda.body))
            term <- integerTerm env.intLocals (Just env.thunkRef) lambda.body
            guard (term.demands == 1)
            pure term.expr
          _ -> Nothing
      else do
        guard (not (containsLocal (snd env.thunkRef) arg))
        term <- integerTerm env.intLocals Nothing arg
        pure term.expr
      ) (Array.mapWithIndex Tuple applied.args)
    result <- call (Qualified (Just env.moduleName) env.worker) env.workerType args
    pure { expr: result, hasBase: false, hasRecursion: true }
  _ -> Nothing

rewriteConsumers :: ModuleName -> Map.Map Ident Producer -> NeutralExpr -> Rewritten
rewriteConsumers moduleName producers expr@(NeutralExpr syn) =
  case syn of
    -- An Int annotation does not prove that a recursive binding is initialized.
    -- Moving its read out of a seed closure could expose an initialization error
    -- before a diverging producer. Keep the entire recursive scope unchanged,
    -- including its body and closures capturing any of its bindings.
    Syn.LetRec _ _ _ -> { expr, used: Set.empty }
    _ -> case immediateConsumer moduleName producers expr of
      Just result -> result
      Nothing ->
        let children = map (rewriteConsumers moduleName producers) syn
        in { expr: NeutralExpr (map _.expr children), used: foldMap _.used children }

immediateConsumer :: ModuleName -> Map.Map Ident Producer -> NeutralExpr -> Maybe Rewritten
immediateConsumer moduleName producers expr = do
  let applied = spine expr
  ident <- case strip applied.head of
    Var (Qualified (Just owner) ident) | owner == moduleName -> Just ident
    _ -> Nothing
  producer <- Map.lookup ident producers
  guard (Array.length applied.args == producer.arity + 1)
  unitArg <- Array.last applied.args
  guard (isUnit unitArg)
  args <- traverse (\(Tuple index arg) ->
    if index == producer.thunkIndex then do
      let lambda = abstractions arg
      guard (case annotation arg of
        Just ty -> intThunk ty
        Nothing -> false)
      case lambda.args of
        [ Tuple _ unitLevel ] -> do
          guard (not (containsLocal unitLevel lambda.body))
          seed <- integerTerm Set.empty Nothing lambda.body
          pure seed.expr
        _ -> Nothing
    else do
      term <- integerTerm Set.empty Nothing arg
      pure term.expr
    ) (Array.mapWithIndex Tuple (Array.take producer.arity applied.args))
  guard (closedSafeExecution producer args)
  result <- call (Qualified (Just moduleName) producer.worker) producer.workerType args
  pure { expr: result, used: Set.singleton producer.worker }

-- A proof budget, never a runtime limit. Unknown inputs, overflowing arithmetic
-- and producers needing more steps keep their original call. Do not replace
-- the worker with the value computed here: the existing Rust pipeline remains
-- responsible for optimizing the emitted loop.
closedSafeExecution :: Producer -> Array NeutralExpr -> Boolean
closedSafeExecution producer args = case traverse (constantInt Map.empty) args of
  Nothing -> false
  Just values ->
    let lambda = abstractions producer.binding
        locals = map snd lambda.args
        loop remaining current
          | remaining <= 0 = false
          | otherwise = case proofTail producer.worker
              (Map.fromFoldable (Array.zip locals current)) lambda.body of
              Just (Done _) -> true
              Just (Next next) -> loop (remaining - 1) next
              Nothing -> false
    in loop 4096 values

data ProofStep = Done Int | Next (Array Int)

proofTail :: Ident -> Map.Map Level Int -> NeutralExpr -> Maybe ProofStep
proofTail worker values expr = case strip expr of
  Branch branches fallback -> choose (NEA.toArray branches)
    where
    choose [] = proofTail worker values fallback
    choose rest = do
      { head: Pair condition body, tail } <- Array.uncons rest
      conditionValue <- constantBoolean values condition
      if conditionValue then proofTail worker values body else choose tail
  App _ _ -> do
    let applied = spine expr
    case strip applied.head of
      Var (Qualified _ ident) | ident == worker ->
        Next <$> traverse (constantInt values) applied.args
      _ -> Nothing
  _ -> Done <$> constantInt values expr

constantInt :: Map.Map Level Int -> NeutralExpr -> Maybe Int
constantInt values expr = case strip expr of
  Lit (LitInt value) -> Just value
  Local _ level -> Map.lookup level values
  PrimOp (Op1 OpIntNegate value) -> do
    operand <- constantInt values value
    Int.fromNumber (negate (Int.toNumber operand))
  PrimOp (Op1 OpIntBitNot value) -> Bits.complement <$> constantInt values value
  PrimOp (Op2 op left right) -> do
    l <- constantInt values left
    r <- constantInt values right
    case op of
      OpIntNum OpAdd -> Int.fromNumber (Int.toNumber l + Int.toNumber r)
      OpIntNum OpSubtract -> Int.fromNumber (Int.toNumber l - Int.toNumber r)
      OpIntNum OpMultiply -> Int.fromNumber (Int.toNumber l * Int.toNumber r)
      OpIntBitAnd -> Just (Bits.and l r)
      OpIntBitOr -> Just (Bits.or l r)
      OpIntBitXor -> Just (Bits.xor l r)
      _ -> Nothing
  _ -> Nothing

constantBoolean :: Map.Map Level Int -> NeutralExpr -> Maybe Boolean
constantBoolean values expr = case strip expr of
  Lit (LitBoolean value) -> Just value
  PrimOp (Op1 OpBooleanNot value) -> not <$> constantBoolean values value
  PrimOp (Op2 (OpIntOrd op) left right) -> do
    l <- constantInt values left
    r <- constantInt values right
    pure $ case op of
      Syn.OpEq -> l == r
      Syn.OpNotEq -> l /= r
      Syn.OpGt -> l > r
      Syn.OpGte -> l >= r
      Syn.OpLt -> l < r
      Syn.OpLte -> l <= r
  _ -> Nothing
