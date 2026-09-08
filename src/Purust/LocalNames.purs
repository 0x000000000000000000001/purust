module Purust.LocalNames (renameLocals) where

import Prelude

import Data.Array as Array
import Data.Array.NonEmpty as NonEmptyArray
import Data.Map as Map
import Data.Maybe (Maybe(..))
import Data.Newtype (unwrap)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (Ident(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), Level)

type Names = Map.Map Level (Map.Map (Maybe Ident) Ident)

-- Local identity is its lexical level, not the optional source spelling. A
-- recursive group shares one level and additionally identifies each member.
-- Assign Rust-safe names before type inference, capture analysis and printing
-- so all three stages agree even when source binders shadow one another.
renameLocals :: NeutralExpr -> NeutralExpr
renameLocals = go Map.empty
  where
  localName :: Level -> Ident
  localName lvl = Ident ("purs_local_" <> show (unwrap lvl))

  bindName :: Names -> Level -> Names
  bindName env lvl = Map.insert lvl (Map.singleton Nothing (localName lvl)) env

  bindParams env params =
    Array.foldl (\acc (Tuple _ lvl) -> bindName acc lvl) env params

  renameParam (Tuple _ lvl) = Tuple (Just (localName lvl)) lvl

  go :: Names -> NeutralExpr -> NeutralExpr
  go env (NeutralExpr syntax) = NeutralExpr case syntax of
    Local ident lvl ->
      case Map.lookup lvl env of
        Just names -> case Map.lookup Nothing names of
          Just name -> Local (Just name) lvl
          Nothing -> case Map.lookup ident names of
            Just name -> Local (Just name) lvl
            Nothing -> Local ident lvl
        Nothing -> Local ident lvl
    -- Var denotes a module/global reference, even without a qualifier. Its
    -- spelling must not be captured by a homonymous local binding.
    Var _ -> syntax
    Abs params body ->
      Abs (map renameParam params) (go (bindParams env (NonEmptyArray.toArray params)) body)
    UncurriedAbs params body ->
      UncurriedAbs (map renameParam params) (go (bindParams env params) body)
    UncurriedEffectAbs params body ->
      UncurriedEffectAbs (map renameParam params) (go (bindParams env params) body)
    Let _ lvl value body ->
      Let (Just (localName lvl)) lvl (go env value) (go (bindName env lvl) body)
    EffectBind _ lvl value body ->
      EffectBind (Just (localName lvl)) lvl (go env value) (go (bindName env lvl) body)
    LetRec lvl bindings body ->
      let
        renamed = NonEmptyArray.mapWithIndex (\i (Tuple ident value) ->
          { ident, value, name: Ident ("purs_local_" <> show (unwrap lvl) <> "_rec_" <> show i) }
          ) bindings
        groupNames = Map.fromFoldable (map (\entry -> Tuple (Just entry.ident) entry.name) renamed)
        groupEnv = Map.insert lvl groupNames env
      in LetRec lvl (map (\entry -> Tuple entry.name (go groupEnv entry.value)) renamed) (go groupEnv body)
    _ -> map (go env) syntax
