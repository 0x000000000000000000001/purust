module Purust.ShareNullaries (shareNullaries) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Set (Set)
import Data.Set as Set
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), Level(..))

-- Share repeated native nullary values only among direct constructor fields.
-- The binding belongs to this construction: there is no global retained root.
-- The caller supplies both the native identity and the preserved TAST type.
shareNullaries
  :: (NeutralExpr -> Maybe { key :: String, ty :: ExprType })
  -> Set String
  -> NeutralExpr
  -> Maybe NeutralExpr
shareNullaries identify reserved (NeutralExpr syn) = case syn of
  CtorSaturated qualified dt typeName ctor fields -> do
    let candidates = Array.mapMaybe (\(Tuple _ value) -> map (\info -> { info, value }) (identify value)) fields
    { info, value } <- Array.find (\candidate ->
      Array.length (Array.filter (\other -> other.info.key == candidate.info.key) candidates) > 1) candidates
    let name = fresh 0
        rewritten = map (\(Tuple label field) -> Tuple label case identify field of
          Just other | other.key == info.key ->
            NeutralExpr (Typed other.ty (NeutralExpr (Local (Just (Ident name)) (Level (-1)))))
          _ -> field) fields
    pure (NeutralExpr (Let (Just (Ident name)) (Level (-1)) value
      (NeutralExpr (CtorSaturated qualified dt typeName ctor rewritten))))
  _ -> Nothing
  where
  fresh index =
    let name = "__purust_empty_" <> show index
    in if Set.member name reserved then fresh (index + 1) else name
