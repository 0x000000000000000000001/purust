module Purust.ReturnCells (rewriteReturns, reuseNestedConstructor) where

import Prelude

import Data.Array as Array
import Data.Array.NonEmpty as NonEmptyArray
import Data.Maybe (Maybe(..))
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), ProperName, Qualified)
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), Level(..), Pair(..))

-- Rewrite only constructors in return position. Nested constructors and calls
-- keep their normal allocation path, and no cell can escape into a closure.
-- Reject the whole worker if any returning path has another representation.
rewriteReturns
  :: (ExprType -> String)
  -> (Qualified Ident -> ProperName -> Maybe { name :: Qualified Ident, resultType :: ExprType })
  -> ExprType
  -> String
  -> NeutralExpr
  -> Maybe NeutralExpr
rewriteReturns representation helperFor resultType cell = go
  where
  go (NeutralExpr syn) = case syn of
    Typed ty inner | representation ty == representation resultType ->
      map (NeutralExpr <<< Typed ty) (go inner)
    Branch branches def -> do
      rewritten <- traverse (\(Pair cond body) -> Pair cond <$> go body) branches
      NeutralExpr <<< Branch rewritten <$> go def
    Let name level value body ->
      NeutralExpr <<< Let name level value <$> go body
    CtorSaturated qualified _ typeName _ fields -> do
      helper <- helperFor qualified typeName
      if representation helper.resultType /= representation resultType then Nothing else
        let args = Array.snoc (map (\(Tuple _ value) -> value) fields)
              (NeutralExpr (Typed helper.resultType (NeutralExpr (Local (Just (Ident cell)) (Level (-1))))))
        in map (NeutralExpr <<< App (NeutralExpr (Var helper.name))) (NonEmptyArray.fromArray args)
    _ -> Nothing

-- Give one already extracted cell to one strict construction. Never descend
-- into a closure, arbitrary call or branch: those may defer or skip the use.
-- Prefer an inner constructor; the outer result may already own another cell.
reuseNestedConstructor
  :: (ExprType -> String)
  -> (Qualified Ident -> ProperName -> Maybe { name :: Qualified Ident, resultType :: ExprType })
  -> (Qualified Ident -> Boolean)
  -> String
  -> String
  -> NeutralExpr
  -> Maybe NeutralExpr
reuseNestedConstructor representation helperFor isBuilder nativeType cell = go
  where
  first values = case Array.uncons values of
    Nothing -> Nothing
    Just { head, tail } -> case go head of
      Just rewritten -> Just (Array.cons rewritten tail)
      Nothing -> Array.cons head <$> first tail

  go (NeutralExpr syn) = case syn of
    Typed ty inner -> NeutralExpr <<< Typed ty <$> go inner
    Let name level value body -> NeutralExpr <<< Let name level value <$> go body
    CtorSaturated qualified dt typeName ctor fields ->
      case first (map (\(Tuple _ value) -> value) fields) of
        Just rewritten -> Just (NeutralExpr (CtorSaturated qualified dt typeName ctor
          (Array.zipWith (\(Tuple label _) value -> Tuple label value) fields rewritten)))
        Nothing -> do
          helper <- helperFor qualified typeName
          if representation helper.resultType /= nativeType then Nothing else do
            args <- NonEmptyArray.fromArray (Array.snoc (map (\(Tuple _ value) -> value) fields)
              (NeutralExpr (Typed helper.resultType (NeutralExpr (Local (Just (Ident cell)) (Level (-1)))))))
            pure (NeutralExpr (App (NeutralExpr (Var helper.name)) args))
    App fn@(NeutralExpr (Var qualified)) args | isBuilder qualified -> do
      rewritten <- first (NonEmptyArray.toArray args)
      NeutralExpr <<< App fn <$> NonEmptyArray.fromArray rewritten
    _ -> Nothing
