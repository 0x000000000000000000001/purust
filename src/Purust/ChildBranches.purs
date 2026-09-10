module Purust.ChildBranches
  ( ConstructorInfo
  , FieldStep
  , TagPath
  , Predicate(..)
  , ConstructorPredicate
  , constructorPredicate
  ) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Set as Set
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), Literal(LitBoolean), ProperName(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn as CoreFn
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), Pair(..))

type ConstructorInfo =
  { resultType :: ExprType
  , fields :: Array ExprType
  }

type FieldStep =
  { constructor :: Qualified Ident
  , typeName :: ProperName
  , index :: Int
  , width :: Int
  , fieldType :: ExprType
  }

type TagPath =
  { parameter :: Int
  , steps :: Array FieldStep
  , finalType :: ExprType
  }

-- If is deliberately ordered. Its true arm can project fields whose
-- constructor was established by the condition; eagerly evaluating both
-- arms, or moving their tests outside this conditional, would be unsound.
data Predicate
  = Constant Boolean
  | IsTag TagPath (Qualified Ident)
  | If Predicate Predicate Predicate

derive instance Eq Predicate

type ConstructorPredicate =
  { constructor :: Qualified Ident
  , typeName :: ProperName
  , fieldParams :: Array Int
  , predicate :: Predicate
  }

type Target =
  { constructor :: Qualified Ident
  , typeName :: ProperName
  , fieldParams :: Array Int
  }

type Fact = { path :: TagPath, constructor :: Qualified Ident }
type Condition = { predicate :: Predicate, whenTrue :: Array Fact, whenFalse :: Array Fact }

-- Select a constructor-only default, then prove exactly those paths which
-- return the same constructor and permutation of the original parameters.
-- The callback supplies native constructor layouts from the TAST. Unknown
-- expressions keep the helper call: False never claims that they are pure.
constructorPredicate
  :: (ExprType -> String)
  -> (ExprType -> Boolean)
  -> (Qualified Ident -> Maybe ConstructorInfo)
  -> Array String
  -> Array ExprType
  -> ExprType
  -> NeutralExpr
  -> Maybe ConstructorPredicate
constructorPredicate representation copyEnum constructorInfo params argTypes resultType body = do
  guard (Array.length params == Array.length argTypes)
  guard (Set.size (Set.fromFoldable params) == Array.length params)
  target <- defaultTarget initial body
  pure
    { constructor: target.constructor
    , typeName: target.typeName
    , fieldParams: target.fieldParams
    , predicate: analyze target initial [] body
    }
  where
  initial = Map.fromFoldable (Array.zipWith (\(Tuple index name) ty ->
    Tuple name { parameter: index, steps: [], finalType: ty })
    (Array.mapWithIndex Tuple params) argTypes)

  compatible left right = representation left == representation right

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

  -- A projection is admitted only after a matching tag test dominates it.
  -- Its field type and complete tuple width come from the declaration, not
  -- from the accessor's optional annotation or its textual field label.
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

  leaf aliases facts constructor typeName fields = do
    info <- layout constructor typeName
    guard (compatible info.resultType resultType)
    guard (Array.length fields == Array.length info.fields)
    paths <- traverse (\(Tuple _ value) -> valuePath aliases facts value) fields
    guard (Array.all (Array.null <<< _.steps) paths)
    guard (Array.all identity (Array.zipWith
      (\path ty -> compatible path.finalType ty) paths info.fields))
    let fieldParams = map _.parameter paths
    guard (Array.length fieldParams == Array.length params)
    guard (Set.size (Set.fromFoldable fieldParams) == Array.length params)
    pure { constructor, typeName, fieldParams }

  defaultTarget :: Map.Map String TagPath -> NeutralExpr -> Maybe Target
  defaultTarget aliases (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty resultType -> defaultTarget aliases inner
    TypeApp inner _ -> defaultTarget aliases inner
    Branch _ def -> defaultTarget aliases def
    Let (Just (Ident name)) _ value inner -> do
      path <- valuePath aliases [] value
      defaultTarget (Map.insert name path aliases) inner
    CtorSaturated constructor _ typeName name fields -> do
      let Qualified _ declaredName = constructor
      guard (name == declaredName)
      leaf aliases [] constructor typeName fields
    _ -> Nothing

  condition :: Map.Map String TagPath -> Array Fact -> NeutralExpr -> Maybe Condition
  condition aliases facts (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty CoreFn.Boolean -> condition aliases facts inner
    TypeApp inner _ -> condition aliases facts inner
    Lit (LitBoolean value) -> Just { predicate: Constant value, whenTrue: facts, whenFalse: facts }
    PrimOp (Op1 (OpIsTag constructor) value) -> do
      path <- valuePath aliases facts value
      info <- constructorInfo constructor
      _ <- typeNameOf info.resultType
      guard (compatible path.finalType info.resultType)
      guard (not (copyEnum info.resultType) || Array.null info.fields)
      let predicate = case factFor facts path of
            Just known -> Constant (known.constructor == constructor)
            Nothing -> IsTag path constructor
      pure { predicate, whenTrue: addFact facts path constructor, whenFalse: facts }
    PrimOp (Op1 OpBooleanNot value) -> do
      tested <- condition aliases facts value
      pure
        { predicate: choose tested.predicate (Constant false) (Constant true)
        , whenTrue: tested.whenFalse
        , whenFalse: tested.whenTrue
        }
    PrimOp (Op2 OpBooleanAnd left right) -> do
      first <- condition aliases facts left
      second <- condition aliases first.whenTrue right
      pure
        { predicate: choose first.predicate second.predicate (Constant false)
        , whenTrue: second.whenTrue
        , whenFalse: facts
        }
    PrimOp (Op2 OpBooleanOr left right) -> do
      first <- condition aliases facts left
      second <- condition aliases first.whenFalse right
      pure
        { predicate: choose first.predicate (Constant true) second.predicate
        , whenTrue: facts
        , whenFalse: second.whenFalse
        }
    _ -> Nothing

  analyze target aliases facts (NeutralExpr syntax) = case syntax of
    Typed ty inner | compatible ty resultType -> analyze target aliases facts inner
    TypeApp inner _ -> analyze target aliases facts inner
    Let (Just (Ident name)) _ value inner -> case valuePath aliases facts value of
      Just path -> analyze target (Map.insert name path aliases) facts inner
      Nothing -> Constant false
    Branch branches def -> branchesPredicate target aliases facts (NEA.toArray branches) def
    CtorSaturated constructor _ typeName name fields ->
      let Qualified _ declaredName = constructor
      in Constant (name == declaredName && fromMaybe false
        (map (_ == target) (leaf aliases facts constructor typeName fields)))
    _ -> Constant false

  branchesPredicate target aliases facts branches def = case Array.uncons branches of
    Nothing -> analyze target aliases facts def
    Just { head: Pair test yes, tail } -> case condition aliases facts test of
      Nothing -> Constant false
      Just tested -> choose tested.predicate
        (analyze target aliases tested.whenTrue yes)
        (branchesPredicate target aliases tested.whenFalse tail def)

choose :: Predicate -> Predicate -> Predicate -> Predicate
choose (Constant true) yes _ = yes
choose (Constant false) _ no = no
choose _ (Constant true) (Constant true) = Constant true
choose _ (Constant false) (Constant false) = Constant false
choose test yes no = If test yes no
