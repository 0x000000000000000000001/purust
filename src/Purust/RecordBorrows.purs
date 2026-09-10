module Purust.RecordBorrows (RecordProjection, recordProjection) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendAccessor(..))
import PureScript.Backend.Optimizer.Syntax as Syn

type RecordProjection =
  { root :: NeutralExpr
  , fields :: Array String
  }

type Projection =
  { root :: NeutralExpr
  , fields :: Array String
  , resultType :: ExprType
  }

-- The row supplies the field types even when a bare GetProp infers Any.
-- Only a local root is borrowed, and the consumer must copy the final scalar
-- before any mutation or call can occur. No borrowed value escapes this plan.
recordProjection
  :: (NeutralExpr -> ExprType)
  -> (ExprType -> String)
  -> ExprType
  -> NeutralExpr
  -> Maybe RecordProjection
recordProjection inferType representation desiredScalar expression =
  if scalar desiredScalar then do
      projection <- inspect expression
      if projection.resultType == desiredScalar && not (Array.null projection.fields) then
        Just { root: projection.root, fields: projection.fields }
      else Nothing
  else Nothing
  where
  scalar = case _ of
    Int -> true
    Number -> true
    Boolean -> true
    Char -> true
    _ -> false

  sameRepresentation left right = representation (inferType left) == representation (inferType right)

  compatibleType actual expected = actual == Any || actual == expected

  closedFields = case _ of
    Record (Row fields Nothing)
      | Array.length (Array.nub (map (\(Tuple label _) -> label) fields)) == Array.length fields -> Just fields
    _ -> Nothing

  -- Preserve the root expression for the printer. A Typed record may supply
  -- the local's TAST row while the underlying binding is stored as Value.
  -- Such a wrapper must not change its representation, and all record
  -- annotations on the root must describe the same closed row.
  localRoot rootType expr@(NeutralExpr syn) = case syn of
    Local _ _ -> compatibleType (inferType expr) rootType
      && representation (inferType expr) == representation rootType
    Typed ty inner -> ty == rootType && sameRepresentation expr inner && localRoot rootType inner
    Syn.TypeApp inner _ -> sameRepresentation expr inner && localRoot rootType inner
    _ -> false

  root expr = do
    let rootType = inferType expr
    _ <- closedFields rootType
    if localRoot rootType expr then Just { root: expr, fields: [], resultType: rootType }
    else Nothing

  inspect :: NeutralExpr -> Maybe Projection
  inspect expr@(NeutralExpr syn) = case root expr of
    Just projection -> Just projection
    Nothing -> case syn of
      Accessor base (GetProp label) -> do
        projection <- inspect base
        fields <- closedFields projection.resultType
        Tuple _ fieldType <- Array.find (\(Tuple key _) -> key == label) fields
        if compatibleType (inferType expr) fieldType then
          Just (projection { fields = Array.snoc projection.fields label, resultType = fieldType })
        else Nothing
      Typed ty inner -> do
        projection <- inspect inner
        -- At a scalar leaf, Typed Int (GetProp ...) performs the normal
        -- Value-to-i64 extraction. Validate against the row, not against the
        -- bare accessor's inferred Any, without admitting another conversion.
        if ty == projection.resultType then Just projection else Nothing
      Syn.TypeApp inner _ | sameRepresentation expr inner -> inspect inner
      _ -> Nothing
