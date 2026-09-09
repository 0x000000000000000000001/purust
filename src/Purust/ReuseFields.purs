module Purust.ReuseFields (scalarFieldUpdate) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.String as String
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Ident(..), Literal(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..))
import PureScript.Backend.Optimizer.Syntax as Syn
import Purust.DataLayout (ValueEnums, isValueEnum)
import Purust.OwnedFields (OwnedFields)

-- Work on the fields after ownership projection rewriting. Every unchanged
-- field must be its own original slot, without a representation conversion.
-- The one replacement is a Copy scalar atom: no call, closure or computation
-- whose evaluation/drop order could change when the payload stays in place.
scalarFieldUpdate
  :: ValueEnums
  -> (ExprType -> String)
  -> (NeutralExpr -> String)
  -> OwnedFields
  -> Array NeutralExpr
  -> Maybe Int
scalarFieldUpdate enums typeRepresentation representation owned values =
  if Array.length values /= Array.length owned.types then Nothing
  else case Array.filter (not <<< _.unchanged) slots of
    [slot] -> do
      ty <- Array.index owned.types slot.index
      if scalar ty && atom slot.value && representation slot.value == typeRepresentation ty
        && Array.all _.compatible slots then Just slot.index else Nothing
    _ -> Nothing
  where
  slots = Array.mapWithIndex (\index value ->
    { index, value
    , unchanged: case Array.index owned.names index of
        Just name -> sameLocal name value
        Nothing -> false
    , compatible: case Array.index owned.types index of
        Just ty -> representation value == typeRepresentation ty
        Nothing -> false
    }) values

  sameLocal name expr@(NeutralExpr syn) = case syn of
    Local (Just (Ident local)) _ -> name == local
    Typed _ inner | representation expr == representation inner -> sameLocal name inner
    Syn.TypeApp inner _ | representation expr == representation inner -> sameLocal name inner
    _ -> false

  atom expr@(NeutralExpr syn) = case syn of
    Local _ _ -> true
    Lit (LitInt _) -> true
    Lit (LitNumber _) -> true
    Lit (LitBoolean _) -> true
    Lit (LitChar _) -> true
    CtorSaturated _ _ _ _ fields -> Array.null fields
    CtorDef _ _ _ fields -> Array.null fields
    Typed _ inner | representation expr == representation inner -> atom inner
    Syn.TypeApp inner _ | representation expr == representation inner -> atom inner
    _ -> false

  scalar = case _ of
    Int -> true
    Number -> true
    Boolean -> true
    Char -> true
    ADT _ fqn _ -> case Array.last fqn of
      Just name -> isValueEnum enums (String.joinWith "_" (Array.dropEnd 1 fqn)) name
      Nothing -> false
    _ -> false
