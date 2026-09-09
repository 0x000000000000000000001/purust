module Purust.RecordUpdates (RecordUpdate(..), RecordReplacement(..), recordUpdate) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..), fromMaybe, isJust)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType(..), Prop(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendAccessor(..))
import PureScript.Backend.Optimizer.Syntax as Syn

-- Follow one child at each level, retaining ordinary replacements for siblings.
-- The plan separates source evaluation from mutation at every depth.
data RecordUpdate = RecordUpdate (Array (Prop RecordReplacement))
data RecordReplacement = RecordValue NeutralExpr | RecordChild RecordUpdate

type ChildUpdate =
  { recordType :: ExprType
  , props :: Array (Prop NeutralExpr)
  , sameSource :: NeutralExpr -> Boolean
  }

recordUpdate
  :: ExprType
  -> (NeutralExpr -> String)
  -> (NeutralExpr -> Boolean)
  -> Array (Prop NeutralExpr)
  -> RecordUpdate
recordUpdate parentType representation sameRoot props =
  let
    candidates = map (\(Prop key value) -> childRecordUpdate parentType representation sameRoot key value) props
    uniqueLabels = Array.length (Array.nub (map (\(Prop key _) -> key) props)) == Array.length props
    chosen = if uniqueLabels then Array.findIndex isJust candidates else Nothing
    replacement i value = case if chosen == Just i then fromMaybe Nothing (Array.index candidates i) else Nothing of
      Just child -> RecordChild (recordUpdate child.recordType representation child.sameSource child.props)
      Nothing -> RecordValue value
  in RecordUpdate (Array.mapWithIndex (\i (Prop key value) -> Prop key (replacement i value)) props)

-- Recognize r { child = r.child { ... } } from the parent's closed TAST row.
-- A bare GetProp currently has an Any inferred type; its layout comes from
-- that row, not from guessing a Rust variant or a benchmark's field names.
childRecordUpdate
  :: ExprType
  -> (NeutralExpr -> String)
  -> (NeutralExpr -> Boolean)
  -> String
  -> NeutralExpr
  -> Maybe ChildUpdate
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
      , Array.length (Array.nub (map (\(Prop label _) -> label) props)) == Array.length props ->
          Just { recordType: childType, props, sameSource: projection childType }
    _ -> Nothing

  projection childType expr@(NeutralExpr syn) = case syn of
    Typed ty inner | ty == childType && representation expr == representation inner -> projection childType inner
    Syn.TypeApp inner _ | representation expr == representation inner -> projection childType inner
    Accessor root (GetProp label) -> label == key && sameRoot root
    _ -> false
