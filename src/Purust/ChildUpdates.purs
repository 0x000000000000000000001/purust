module Purust.ChildUpdates (ChildUpdate, childUpdate) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Array.NonEmpty as NEA
import Data.Maybe (Maybe(..))
import Data.Traversable (traverse)
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), Literal(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendOperator(..), BackendOperator2(..), BackendOperatorNum(..))
import Purust.ChildCalls (ConstructorCase)
import Purust.OwnedFields (OwnedFields)

type ChildUpdate =
  { index :: Int
  , sibling :: Int
  , replacement :: NeutralExpr
  , values :: Array NeutralExpr
  }

-- Work after projection rewriting. One child enters a saturated native call;
-- every other result is its original field. The remaining call arguments are
-- Copy atoms or integer +, -, * expressions, so the uniqueness guard adds no
-- observable computation before them and the call preserves their
-- evaluation. No parent, sibling, closure or opaque conversion can escape.
childUpdate
  :: (ExprType -> String)
  -> (NeutralExpr -> String)
  -> (NeutralExpr -> Boolean)
  -> (ExprType -> Boolean)
  -> ConstructorCase
  -> OwnedFields
  -> Array NeutralExpr
  -> Maybe ChildUpdate
childUpdate typeRepresentation representation closedCall copyScalar branch owned args = do
  values <- traverse (Array.index args) branch.fieldParams
  guard (Array.length values == Array.length owned.types)
  let unchanged i value = case Array.index owned.names i of
        Just name -> sameLocal name value
        Nothing -> false
      changed = Array.filter (\i -> case Array.index values i of
        Just value -> not (unchanged i value)
        Nothing -> true) (Array.mapWithIndex (\i _ -> i) values)
  index <- case changed of
    [i] -> Just i
    _ -> Nothing
  ty <- Array.index owned.types index
  name <- Array.index owned.names index
  replacement <- Array.index values index
  guard (typeRepresentation ty == "std::rc::Rc<" <> owned.nativeType <> ">")
  guard (representation replacement == typeRepresentation ty)
  guard (Array.all identity (Array.zipWith
    (\fieldType value -> typeRepresentation fieldType == representation value) owned.types values))
  callArgs <- case strip replacement of
    NeutralExpr (App _ xs) | closedCall replacement -> Just (NEA.toArray xs)
    _ -> Nothing
  guard (Array.length (Array.filter (sameLocal name) callArgs) == 1)
  guard (Array.all (\arg -> sameLocal name arg || scalarAtom arg) callArgs)
  -- A guard must read an unchanged scalar field, never the recursive call.
  guard (Array.all (\condition -> case Array.index args condition.parameter of
    Just value -> Array.any (\i -> case Array.index owned.types i, Array.index owned.names i of
      Just fieldType, Just fieldName -> copyScalar fieldType && sameLocal fieldName value
      _, _ -> false) (Array.mapWithIndex (\i _ -> i) owned.types)
    Nothing -> false) branch.guards)
  sibling <- Array.find (\i -> i /= index && case Array.index owned.types i of
    Just siblingType -> typeRepresentation siblingType == typeRepresentation ty
    Nothing -> false) (Array.mapWithIndex (\i _ -> i) owned.types)
  pure { index, sibling, replacement, values }
  where
  strip wrapped@(NeutralExpr syn) = case syn of
    Typed _ inner | representation wrapped == representation inner -> strip inner
    TypeApp inner _ | representation wrapped == representation inner -> strip inner
    _ -> wrapped

  sameLocal name value = case strip value of
    NeutralExpr (Local (Just (Ident found)) _) -> name == found
    _ -> false

  scalarAtom value = case strip value of
    NeutralExpr (Local _ _) -> Array.elem (representation value) ["i64", "f64", "bool", "char"]
    NeutralExpr (Lit (LitInt _)) -> representation value == "i64"
    NeutralExpr (Lit (LitNumber _)) -> representation value == "f64"
    NeutralExpr (Lit (LitBoolean _)) -> representation value == "bool"
    NeutralExpr (Lit (LitChar _)) -> representation value == "char"
    NeutralExpr (PrimOp (Op2 (OpIntNum operator) left right)) ->
      Array.elem operator [OpAdd, OpSubtract, OpMultiply]
        && representation value == "i64" && representation left == "i64"
        && representation right == "i64" && scalarAtom left && scalarAtom right
    _ -> false
