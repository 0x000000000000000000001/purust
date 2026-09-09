module Purust.OwnedFields (OwnedFields, fieldSources, rewriteFields) where

import Prelude

import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Set (Set)
import Data.Set as Set
import Data.String as String
import Data.String.Pattern (Pattern(..), Replacement(..))
import Data.Traversable (traverse)
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), ModuleName(..), ProperName(..), Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendAccessor(..), BackendSyntax(..), Level(..))

type OwnedFields =
  { source :: String
  , nativeType :: String
  , constructor :: String
  , constructorName :: String
  , names :: Array String
  , types :: Array ExprType
  }

-- Candidates must be unconditional projections of native locals. The caller
-- supplies representations and constructor fields derived from the TAST.
fieldSources
  :: (NeutralExpr -> String)
  -> (NeutralExpr -> Maybe String)
  -> (String -> Maybe (Array ExprType))
  -> (String -> String)
  -> String
  -> Set String
  -> Array NeutralExpr
  -> Array OwnedFields
fieldSources operandType localName constructorFields sanitize currentMod alive = Array.mapMaybe source
  where
  source (NeutralExpr (Typed _ inner)) = source inner
  source (NeutralExpr (TypeApp inner _)) = source inner
  source (NeutralExpr (Accessor base (GetCtorField (Qualified mbMod _) _ (ProperName ty) (Ident ctor) _ _))) = do
    name <- localName base
    let modName = case mbMod of
          Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn
          Nothing -> currentMod
        nativeType = (if modName == currentMod then "crate::" else "Purs_" <> modName <> "::") <> sanitize ty
    types <- constructorFields (modName <> "_" <> ctor)
    if Set.member name alive || operandType base /= "std::rc::Rc<" <> nativeType <> ">" || Array.null types
      then Nothing
      else Just
        { source: name, nativeType, constructor: nativeType <> "::" <> sanitize ctor, constructorName: ctor, types
        , names: Array.mapWithIndex (\i _ -> "_owned_" <> name <> "_" <> show i) types
        }
  source _ = Nothing

-- Every use of the parent must be a projection of this constructor. In
-- particular, storing or capturing the parent itself forbids early extraction.
-- Repeated field uses become repeated local uses, preserving normal liveness.
rewriteFields
  :: (NeutralExpr -> String)
  -> (NeutralExpr -> Maybe String)
  -> OwnedFields
  -> NeutralExpr
  -> Maybe NeutralExpr
rewriteFields operandType localName fields = go
  where
  go expr@(NeutralExpr syn) = case syn of
    Accessor base (GetCtorField _ _ _ (Ident ctor) _ index)
      | localName base == Just fields.source
      , operandType base == "std::rc::Rc<" <> fields.nativeType <> ">"
      , ctor == fields.constructorName -> do
          name <- Array.index fields.names index
          ty <- Array.index fields.types index
          pure (NeutralExpr (Typed ty (NeutralExpr (Local (Just (Ident name)) (Level 0)))))
    Local _ _ | localName expr == Just fields.source -> Nothing
    _ -> NeutralExpr <$> traverse go syn
