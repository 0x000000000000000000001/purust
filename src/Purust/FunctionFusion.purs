module Purust.FunctionFusion (countedFunctionProducers) where

import Prelude hiding (one)

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Maybe (Maybe(..))
import Data.Set (Set)
import Data.Set as Set
import Data.Tuple (Tuple(..), snd)
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Ident, Literal(..), ModuleName, Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(Abs, App, Branch, Let, Lit, Local, PrimOp, Typed, Var), Level, Pair(..))
import PureScript.Backend.Optimizer.Syntax as Syn

type Groups = Array (BackendBindingGroup Ident NeutralExpr)

-- Recognize a typed iterator encoded as a recursive function producer:
-- build 0 = identity; build n = let previous = build (n - 1) in
--   \f x -> f (previous f x).
-- Only its already-saturated Rust wrapper uses the loop, guarded by n >= 0.
-- The original producer is retained for the negative fallback. Partial values
-- and their capture/evaluation boundaries keep the existing ABI.
countedFunctionProducers :: ModuleName -> Groups -> Set Ident
countedFunctionProducers current groups = Set.fromFoldable $ Array.mapMaybe recognize groups
  where
  identities = Set.fromFoldable $ Array.concatMap
    (Array.mapMaybe (\(Tuple name expr) -> if isIdentity expr then Just name else Nothing) <<< _.bindings) groups
  recognize group = case group.bindings of
    [Tuple name expr] | group.recursive -> do
      guard (annotation expr == Just producerType)
      lambda <- abstractions producerType expr
      counter <- one lambda.args
      branch <- case at functionType lambda.body of
        Just (Branch branches step) -> case NEA.toArray branches of
          [Pair condition seed] -> Just { condition, seed, step }
          _ -> Nothing
        _ -> Nothing
      Tuple left right <- case at Boolean branch.condition of
        Just (PrimOp (Syn.Op2 (Syn.OpIntOrd Syn.OpEq) left right)) -> Just (Tuple left right)
        _ -> Nothing
      guard ((local Int counter left && literal 0 right) || (literal 0 left && local Int counter right))
      guard (identitySeed branch.seed)
      step <- case at functionType branch.step of
        Just (Let _ previous built continuation) -> Just { previous, built, continuation }
        _ -> Nothing
      built <- application functionType step.built
      qualified <- case at producerType built.head of
        Just (Var qualifiedName) -> Just qualifiedName
        _ -> Nothing
      guard (here name qualified)
      decrement <- one built.args
      Tuple n amount <- case at Int decrement of
        Just (PrimOp (Syn.Op2 (Syn.OpIntNum Syn.OpSubtract) n amount)) -> Just (Tuple n amount)
        _ -> Nothing
      guard (local Int counter n && literal 1 amount)
      returned <- abstractions functionType step.continuation
      Tuple f x <- two returned.args
      applied <- application Int returned.body
      guard (local callbackType f applied.head)
      inner <- one applied.args
      nested <- application Int inner
      guard (local functionType step.previous nested.head)
      Tuple passedF passedX <- two nested.args
      guard (local callbackType f passedF && local Int x passedX)
      pure name
    _ -> Nothing
  here name (Qualified moduleName ident) = ident == name && (moduleName == Nothing || moduleName == Just current)
  identitySeed seed = case at functionType seed of
    Just (Var (Qualified moduleName ident)) ->
      (moduleName == Nothing || moduleName == Just current) && Set.member ident identities
    _ -> isIdentity seed

callbackType :: ExprType
callbackType = Func [Int] Int

functionType :: ExprType
functionType = Func [callbackType, Int] Int

producerType :: ExprType
producerType = Func [Int, callbackType, Int] Int

-- Normalize arrow grouping, but do not erase representation-changing Typed
-- nodes. A polymorphic identity's bound type variable remains the same on both
-- sides; arbitrary conversions, dictionary constraints and opaque bases fail.
normalize :: ExprType -> ExprType
normalize (ForAll _ ty) = normalize ty
normalize (Func args ret) = case normalize ret of
  Func more result -> Func (map normalize args <> more) result
  result -> Func (map normalize args) result
normalize ty = ty

at :: ExprType -> NeutralExpr -> Maybe (Syn.BackendSyntax NeutralExpr)
at expected (NeutralExpr syn) = case syn of
  Typed ty inner -> do
    guard (normalize ty == normalize expected)
    at expected inner
  Syn.TypeApp inner _ -> at expected inner
  _ -> Just syn

annotation :: NeutralExpr -> Maybe ExprType
annotation (NeutralExpr syn) = case syn of
  Typed ty _ -> Just (normalize ty)
  Syn.TypeApp inner _ -> annotation inner
  _ -> Nothing

abstractions :: ExprType -> NeutralExpr -> Maybe { args :: Array Level, body :: NeutralExpr }
abstractions ty expr = do
  syn <- at ty expr
  case syn of
    Abs parameters body -> do
      arrow <- case normalize ty of
        Func args result -> Just { args, result }
        _ -> Nothing
      let refs = map snd (NEA.toArray parameters)
          count = Array.length refs
      guard (count <= Array.length arrow.args)
      let rest = Array.drop count arrow.args
          bodyType = if Array.null rest then arrow.result else Func rest arrow.result
      tail <- abstractions bodyType body
      pure { args: refs <> tail.args, body: tail.body }
    _ -> pure { args: [], body: expr }

isIdentity :: NeutralExpr -> Boolean
isIdentity expr = case check of
  Just _ -> true
  Nothing -> false
  where
  check = do
    ty <- annotation expr
    x <- case ty of
      Func [Func [a] b, x] result | a == x && b == x && result == x -> Just x
      _ -> Nothing
    lambda <- abstractions ty expr
    Tuple _ value <- two lambda.args
    guard (local x value lambda.body)

one :: forall a. Array a -> Maybe a
one = case _ of
  [value] -> Just value
  _ -> Nothing

two :: forall a. Array a -> Maybe (Tuple a a)
two = case _ of
  [a, b] -> Just (Tuple a b)
  _ -> Nothing

application :: ExprType -> NeutralExpr -> Maybe { head :: NeutralExpr, args :: Array NeutralExpr }
application ty expr = case at ty expr of
  Just (App head args) -> Just { head, args: NEA.toArray args }
  _ -> Nothing

local :: ExprType -> Level -> NeutralExpr -> Boolean
local ty level expr = case at ty expr of
  Just (Local _ found) -> found == level
  _ -> false

literal :: Int -> NeutralExpr -> Boolean
literal value expr = case at Int expr of
  Just (Lit (LitInt found)) -> found == value
  _ -> false
