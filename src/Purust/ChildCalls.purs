module Purust.ChildCalls (ConstructorCase, constructorCases, closedFunctions) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Foldable (foldMap)
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Set (Set)
import Data.Set as Set
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (ExprType(Boolean), Ident(..), ModuleName, ProperName, Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendOperator(..), BackendOperator1(..), Pair(..))

type ConstructorCase =
  { guards :: Array { parameter :: Int, constructor :: Qualified Ident, matches :: Boolean }
  , constructor :: Qualified Ident
  , typeName :: ProperName
  , fieldParams :: Array Int
  }

-- A helper's default may simply rebuild its arguments after testing a Copy
-- enum. Only follow such defaults: the other branch can contain arbitrary
-- matching or rotations, and contributes no proof to this shortcut.
-- Parameters and local aliases have already been renamed by LocalNames.
constructorCases
  :: (ExprType -> String)
  -> (ExprType -> Boolean)
  -> Array String
  -> Array ExprType
  -> ExprType
  -> NeutralExpr
  -> Array ConstructorCase
constructorCases representation copyEnum params argTypes resultType body =
  if Array.length params /= Array.length argTypes then []
  else fromMaybe [] (go initial [] body)
  where
  initial = Map.fromFoldable (Array.mapWithIndex (\index name -> Tuple name index) params)

  parameter aliases (NeutralExpr syntax) = case syntax of
    Local (Just (Ident name)) _ -> Map.lookup name aliases
    Typed ty inner -> do
      index <- parameter aliases inner
      expected <- Array.index argTypes index
      guard (representation ty == representation expected)
      pure index
    TypeApp inner _ -> parameter aliases inner
    _ -> Nothing

  tested aliases (NeutralExpr syntax) = case syntax of
    Typed ty inner | representation ty == representation Boolean -> tested aliases inner
    TypeApp inner _ -> tested aliases inner
    PrimOp (Op1 (OpIsTag constructor) value) -> do
      index <- parameter aliases value
      ty <- Array.index argTypes index
      guard (copyEnum ty)
      pure { parameter: index, constructor, matches: false }
    _ -> Nothing

  go aliases guards (NeutralExpr syntax) = case syntax of
    Typed ty inner | representation ty == representation resultType -> go aliases guards inner
    TypeApp inner _ -> go aliases guards inner
    Let (Just (Ident name)) _ value inner -> do
      index <- parameter aliases value
      go (Map.insert name index aliases) guards inner
    Branch branches def -> do
      excluded <- traverse (\(Pair condition _) -> tested aliases condition) (NEA.toArray branches)
      go aliases (guards <> excluded) def
    CtorSaturated constructor _ typeName _ fields -> do
      fieldParams <- traverse (\(Tuple _ value) -> parameter aliases value) fields
      guard (Array.length fieldParams == Array.length params)
      guard (Set.size (Set.fromFoldable fieldParams) == Array.length params)
      pure [{ guards, constructor, typeName, fieldParams }]
    _ -> Nothing

-- Prove a closed first-order call graph from binding bodies, including
-- mutually recursive groups. An opaque global, effect, callback, partial
-- application or nested closure rejects its caller and then its dependants.
-- This proves the call graph only; representation and field/drop eligibility
-- remain the responsibility of the caller's TAST-based checks.
closedFunctions
  :: ModuleName
  -> Array (BackendBindingGroup Ident NeutralExpr)
  -> Set String
closedFunctions current groups = fixedPoint (Set.fromFoldable (Map.keys dependencies))
  where
  functions = Map.fromFoldable $ Array.concatMap
    (Array.mapMaybe (\(Tuple (Ident name) expr) ->
      let fn = leading 0 expr
      in if fn.arity > 0 then Just (Tuple name fn) else Nothing) <<< _.bindings) groups

  leading arity expr@(NeutralExpr syntax) = case syntax of
    Typed _ inner -> leading arity inner
    TypeApp inner _ -> leading arity inner
    Abs params body -> leading (arity + NEA.length params) body
    _ -> { arity, body: expr }

  direct (NeutralExpr syntax) = case syntax of
    Typed _ inner -> direct inner
    TypeApp inner _ -> direct inner
    Var (Qualified moduleName (Ident name))
      | moduleName == Nothing || moduleName == Just current -> Just name
    _ -> Nothing

  application expr args = case expr of
    NeutralExpr (Typed _ inner) -> application inner args
    NeutralExpr (TypeApp inner _) -> application inner args
    NeutralExpr (App fn more) -> application fn (NEA.toArray more <> args)
    _ -> do
      name <- direct expr
      fn <- Map.lookup name functions
      guard (fn.arity == Array.length args)
      calls <- children args
      pure (Set.insert name calls)

  children values = Array.foldl Set.union Set.empty <$> traverse scan values

  descend syntax = children (foldMap Array.singleton syntax)

  scan (NeutralExpr syntax) = case syntax of
    App fn args -> application fn (NEA.toArray args)
    UncurriedApp _ _ -> Nothing
    Local _ _ -> Just Set.empty
    CtorDef _ _ _ fields | Array.null fields -> Just Set.empty
    Lit _ -> descend syntax
    Accessor _ _ -> descend syntax
    Update _ _ -> descend syntax
    CtorSaturated _ _ _ _ _ -> descend syntax
    Let _ _ _ _ -> descend syntax
    Branch _ _ -> descend syntax
    PrimOp _ -> descend syntax
    Typed _ _ -> descend syntax
    TypeApp _ _ -> descend syntax
    Fail _ -> Just Set.empty
    _ -> Nothing

  dependencies = Map.fromFoldable $ Array.mapMaybe
    (\(Tuple name fn) -> Tuple name <$> scan fn.body)
    (Map.toUnfoldable functions :: Array (Tuple String { arity :: Int, body :: NeutralExpr }))

  fixedPoint candidates =
    let remaining = Set.filter (\name -> case Map.lookup name dependencies of
          Just calls -> Set.isEmpty (Set.difference calls candidates)
          Nothing -> false) candidates
    in if remaining == candidates then candidates else fixedPoint remaining
