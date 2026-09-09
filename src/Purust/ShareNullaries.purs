module Purust.ShareNullaries (shareNullaries, reuseNullaries) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Set (Set)
import Data.Set as Set
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), Level(..))
import PureScript.Backend.Optimizer.Syntax as Syn

-- In the successful arm of a tag test, a native local already is this nullary
-- value. Reuse it in strict constructor trees; normal liveness retains any
-- aliases needed afterwards. Stop at calls and scopes rather than introducing
-- captures or carrying a branch fact into deferred computations.
reuseNullaries
  :: (NeutralExpr -> Maybe { key :: String, ty :: ExprType })
  -> (NeutralExpr -> String)
  -> String
  -> NeutralExpr
  -> NeutralExpr
  -> NeutralExpr
reuseNullaries identify representation key existing = go
  where
  go expr@(NeutralExpr syn) = case identify expr of
    Just info | info.key == key -> NeutralExpr (Typed info.ty existing)
    _ -> case syn of
      Typed ty inner | representation expr == representation inner ->
        NeutralExpr (Typed ty (go inner))
      Syn.TypeApp inner ty -> NeutralExpr (Syn.TypeApp (go inner) ty)
      CtorSaturated qualified dt typeName ctor fields ->
        NeutralExpr (CtorSaturated qualified dt typeName ctor (map (map go) fields))
      _ -> expr

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
