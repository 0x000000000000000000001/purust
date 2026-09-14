module Purust.FieldPermutations
  ( ScalarValue(..)
  , ScalarWrite
  , FieldPermutation
  , fieldPermutation
  ) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Map as Map
import Data.Maybe (Maybe(..))
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), Literal(..), ProperName(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn as CoreFn
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendSyntax(..), Pair(..))
import Purust.ChildBranches (ConstructorInfo, Predicate(..), TagPath, constructorPredicate)

-- Levels identify the original retained cells: root, child, grandchild.
-- Scalar RHS values are copied before the emitter changes any cell.
data ScalarValue
  = ScalarPath { level :: Int, index :: Int }
  | ScalarConstructor (Qualified Ident)

type ScalarWrite = { level :: Int, index :: Int, value :: ScalarValue }

type FieldPermutation =
  { constructor :: Qualified Ident
  , typeName :: ProperName
  , fields :: Array ExprType
  , fieldParams :: Array Int
  , forward :: Int
  , reverse :: Int
  , predicate :: Predicate
  , writes :: Array ScalarWrite
  }

type Fact = { path :: TagPath, constructor :: Qualified Ident }
type Leaf =
  { aliases :: Map.Map String TagPath
  , facts :: Array Fact
  , predicate :: Predicate
  , value :: NeutralExpr
  }

-- A deliberately bounded topology proof: three reconstructions of one
-- native constructor replace a root/child/grandchild chain. Its two recursive
-- fields may occur at any positions. The output must conserve every frontier
-- subtree exactly once. Other fields are native Copy values. Only the first
-- true arm is followed; an earlier unknown computation rejects the shortcut.
fieldPermutation
  :: (ExprType -> String)
  -> (ExprType -> Boolean)
  -> (ExprType -> Boolean)
  -> (Qualified Ident -> Maybe ConstructorInfo)
  -> Array String
  -> Array ExprType
  -> ExprType
  -> NeutralExpr
  -> Maybe FieldPermutation
fieldPermutation representation copyScalar copyEnum constructorInfo params argTypes resultType body = do
  target <- constructorPredicate representation copyEnum constructorInfo params argTypes resultType body
  info <- constructorInfo target.constructor
  guard (compatible info.resultType resultType)
  let recursive = Array.mapMaybe (\(Tuple i ty) ->
        if compatible ty resultType then Just i else Nothing) (Array.mapWithIndex Tuple info.fields)
  Tuple first second <- case recursive of
    [first, second] -> Just (Tuple first second)
    _ -> Nothing
  guard (not (copyEnum resultType))
  guard (Array.all (\ty -> compatible ty resultType || copyScalar ty) info.fields)
  leaf <- firstLeaf initial [] (Constant true) body
  rootFields <- rebuilt target.constructor target.typeName resultType leaf.value
  let candidate forward reverse = do
        left <- Array.index rootFields forward >>= rebuilt target.constructor target.typeName resultType
        right <- Array.index rootFields reverse >>= rebuilt target.constructor target.typeName resultType
        guard (Array.length rootFields == Array.length info.fields
          && Array.length left == Array.length info.fields && Array.length right == Array.length info.fields)
        -- Under the selected placement, the original grandchild is the
        -- result's forward child and the original child its reverse child.
        frontier target.constructor leaf target.fieldParams left forward [forward, forward, forward]
        frontier target.constructor leaf target.fieldParams left reverse [forward, forward, reverse]
        frontier target.constructor leaf target.fieldParams right forward [forward, reverse]
        frontier target.constructor leaf target.fieldParams right reverse [reverse]
        rootWrites <- scalarWrites target.constructor leaf target.fieldParams info.fields forward 0 rootFields
        childWrites <- scalarWrites target.constructor leaf target.fieldParams info.fields forward 1 right
        grandchildWrites <- scalarWrites target.constructor leaf target.fieldParams info.fields forward 2 left
        pure
          { constructor: target.constructor, typeName: target.typeName, fields: info.fields
          , fieldParams: target.fieldParams, forward, reverse, predicate: leaf.predicate
          , writes: rootWrites <> childWrites <> grandchildWrites
          }
  case candidate first second of
    Just plan -> Just plan
    Nothing -> candidate second first
  where
  compatible left right = representation left == representation right

  initial = Map.fromFoldable (Array.zipWith (\(Tuple parameter name) finalType ->
    Tuple name { parameter, steps: [], finalType }) (Array.mapWithIndex Tuple params) argTypes)

  typeNameOf = case _ of
    CoreFn.ADT _ names _ -> ProperName <$> Array.last names
    CoreFn.ForAll _ ty -> typeNameOf ty
    CoreFn.TypeApp ty _ -> typeNameOf ty
    _ -> Nothing

  layout constructor typeName = do
    info <- constructorInfo constructor
    guard (typeNameOf info.resultType == Just typeName)
    guard (not (copyEnum info.resultType) || Array.null info.fields)
    pure info

  factFor facts path = Array.find (\fact -> fact.path == path) facts

  addFact facts path constructor =
    Array.snoc (Array.filter (\fact -> fact.path /= path) facts) { path, constructor }

  valuePath aliases facts (NeutralExpr syntax) = case syntax of
    Local (Just (Ident name)) _ -> Map.lookup name aliases
    Typed ty inner -> do
      path <- valuePath aliases facts inner
      guard (compatible ty path.finalType)
      pure path
    TypeApp inner _ -> valuePath aliases facts inner
    Accessor base (GetCtorField constructor _ typeName name _ index) -> do
      let Qualified _ declaredName = constructor
      guard (name == declaredName)
      path <- valuePath aliases facts base
      info <- layout constructor typeName
      guard (compatible path.finalType info.resultType)
      known <- factFor facts path
      guard (known.constructor == constructor)
      fieldType <- Array.index info.fields index
      pure
        { parameter: path.parameter
        , steps: Array.snoc path.steps
            { constructor, typeName, index, width: Array.length info.fields, fieldType }
        , finalType: fieldType
        }
    _ -> Nothing

  condition aliases facts (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty CoreFn.Boolean -> condition aliases facts inner
    TypeApp inner _ -> condition aliases facts inner
    Lit (LitBoolean true) -> Just { predicate: Constant true, facts }
    PrimOp (Op1 (OpIsTag constructor) value) -> do
      path <- valuePath aliases facts value
      info <- constructorInfo constructor
      _ <- typeNameOf info.resultType
      guard (compatible path.finalType info.resultType)
      guard (not (copyEnum info.resultType) || Array.null info.fields)
      let predicate = case factFor facts path of
            Just known -> Constant (known.constructor == constructor)
            Nothing -> IsTag path constructor
      guard (predicate /= Constant false)
      pure { predicate, facts: addFact facts path constructor }
    PrimOp (Op2 OpBooleanAnd left right) -> do
      first <- condition aliases facts left
      second <- condition aliases first.facts right
      pure { predicate: conjunction first.predicate second.predicate, facts: second.facts }
    _ -> Nothing

  firstLeaf aliases facts predicate value@(NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty resultType -> firstLeaf aliases facts predicate inner
    TypeApp inner _ -> firstLeaf aliases facts predicate inner
    Let (Just (Ident name)) _ val inner -> do
      path <- valuePath aliases facts val
      firstLeaf (Map.insert name path aliases) facts predicate inner
    Branch branches _ -> do
      let Pair test yes = NEA.head branches
      tested <- condition aliases facts test
      firstLeaf aliases tested.facts (conjunction predicate tested.predicate) yes
    CtorSaturated _ _ _ _ _ -> Just { aliases, facts, predicate, value }
    _ -> Nothing

  rebuilt constructor typeName expected (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty expected -> rebuilt constructor typeName expected inner
    TypeApp inner _ -> rebuilt constructor typeName expected inner
    CtorSaturated found _ foundType foundName fields -> do
      let Qualified _ declaredName = constructor
      guard (found == constructor && foundType == typeName && foundName == declaredName)
      info <- layout found foundType
      guard (compatible info.resultType expected && Array.length fields == Array.length info.fields)
      pure (map (\(Tuple _ value) -> value) fields)
    _ -> Nothing

  physicalPath constructor fieldParams path = do
    -- Numeric indices alone do not identify slots: another constructor of
    -- the same ADT may place a different native type at the same index.
    guard (Array.all (\step -> step.constructor == constructor) path.steps)
    root <- Array.findIndex (_ == path.parameter) fieldParams
    pure (Array.cons root (map _.index path.steps))

  frontier constructor leaf fieldParams values index expected = do
    value <- Array.index values index
    path <- valuePath leaf.aliases leaf.facts value
    guard (compatible path.finalType resultType)
    physical <- physicalPath constructor fieldParams path
    guard (physical == expected)

  scalarPath constructor leaf fieldParams forward expected value = do
    path <- valuePath leaf.aliases leaf.facts value
    guard (compatible path.finalType expected && copyScalar expected)
    physical <- physicalPath constructor fieldParams path
    index <- Array.last physical
    let prefix = Array.dropEnd 1 physical
    level <- if Array.null prefix then Just 0
      else if prefix == [forward] then Just 1
      else if prefix == [forward, forward] then Just 2
      else Nothing
    pure (ScalarPath { level, index })

  scalarConstructor expected (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty expected -> scalarConstructor expected inner
    TypeApp inner _ -> scalarConstructor expected inner
    CtorSaturated constructor _ typeName name fields | Array.null fields -> do
      let Qualified _ declaredName = constructor
      guard (name == declaredName)
      info <- layout constructor typeName
      guard (Array.null info.fields && copyEnum info.resultType && compatible info.resultType expected)
      pure (ScalarConstructor constructor)
    CtorDef _ typeName name fields | Array.null fields -> do
      let constructor = Qualified Nothing name
      info <- layout constructor typeName
      guard (Array.null info.fields && copyEnum info.resultType && compatible info.resultType expected)
      pure (ScalarConstructor constructor)
    _ -> Nothing

  scalarWrites constructor leaf fieldParams fields forward level values = do
    let scalarFields = Array.filter (\(Tuple _ ty) -> copyScalar ty) (Array.mapWithIndex Tuple fields)
    traverse (\(Tuple index expected) -> do
      value <- Array.index values index
      scalar <- case scalarPath constructor leaf fieldParams forward expected value of
        Just path -> Just path
        Nothing -> scalarConstructor expected value
      pure { level, index, value: scalar }) scalarFields

conjunction :: Predicate -> Predicate -> Predicate
conjunction (Constant true) right = right
conjunction left (Constant true) = left
conjunction left right = If left right (Constant false)
