module Purust.RecordUpdates (childRecordUpdate) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Prop(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendAccessor(..))
import PureScript.Backend.Optimizer.Syntax as Syn

-- Recognize r { child = r.child { ... } } from the parent's closed TAST row.
-- A bare GetProp currently has an Any inferred type; its layout comes from
-- that row, not from guessing a Rust variant or a benchmark's field names.
childRecordUpdate
  :: ExprType
  -> (NeutralExpr -> String)
  -> (NeutralExpr -> Boolean)
  -> String
  -> NeutralExpr
  -> Maybe (Array (Prop NeutralExpr))
childRecordUpdate parentType representation sameRoot key value = case parentType of
  Record (Row fields Nothing) -> do
    Tuple _ childType <- Array.find (\(Tuple label _) -> label == key) fields
    case childType of
      Record (Row childFields Nothing) -> update childType childFields value
      _ -> Nothing
  _ -> Nothing
  where
  update childType fields expr@(NeutralExpr syn) = case syn of
    Typed ty inner | ty == childType && representation expr == representation inner -> update childType fields inner
    Syn.TypeApp inner _ | representation expr == representation inner -> update childType fields inner
    Update source props
      | projection childType source
      , not (Array.null props)
      , Array.all (\(Prop label _) -> Array.any (\(Tuple field _) -> field == label) fields) props
      , Array.length (Array.nub (map (\(Prop label _) -> label) props)) == Array.length props -> Just props
    _ -> Nothing

  projection childType expr@(NeutralExpr syn) = case syn of
    Typed ty inner | ty == childType && representation expr == representation inner -> projection childType inner
    Syn.TypeApp inner _ | representation expr == representation inner -> projection childType inner
    Accessor root (GetProp label) -> label == key && sameRoot root
    _ -> false
