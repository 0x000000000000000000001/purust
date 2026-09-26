-- | Global specialisation for the Rust backend.
-- |
-- | The optimizer keeps polymorphic definitions generic, so a Church numeral
-- | or a fold passed through a type variable stays boxed at every use. This
-- | pass collects the types a global is actually instantiated at, injects a
-- | specialised binding for each of them, and rewrites the call sites, which
-- | also eliminates the dictionaries that become dead (DPE).
-- |
-- | Ported from the Go backend integration (`Gopurs.Monomorphization`), which
-- | runs the same pass in production.
module Purust.Monomorphization
  ( buildGlobalTypes
  , monomorphizeModules
  ) where

import Prelude

import Data.Array as Array
import Data.Foldable (foldl)
import Data.List (List)
import Data.Map (Map)
import Data.Map as Map
import Data.Maybe (Maybe(..))
import Data.Newtype (unwrap)
import Data.Set (Set)
import Data.Set as Set
import Data.String as String
import Data.String.Pattern (Pattern(..))
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (Ann(..), Bind(..), Binding(..), Expr(..), ExprType(..), Ident(..), Module(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn.Usage (invalidateSourceUsageModule)
import PureScript.Backend.Optimizer.Monomorphize (Instantiation, InstantiationMap, collectInstantiations, getExprAnn, monomorphize, transitiveCollect)

type GlobalAstMap = Map String (Binding Ann)

-- | TAST types indexed by qualified name, foreign declarations included. The
-- | monomorphizer filters candidates with the type table captured before any
-- | specialisation happened.
buildGlobalTypes :: Array (Module Ann) -> Map String ExprType
buildGlobalTypes = Array.foldl addModuleTypes Map.empty

addModuleTypes :: Map String ExprType -> Module Ann -> Map String ExprType
addModuleTypes types (Module mod) =
  let
    moduleName = unwrap mod.name
    withDefinitions = Array.foldl (addBindTypes moduleName) types mod.decls
    foreignTypes = Map.toUnfoldable mod.foreign :: Array (Tuple Ident (Maybe ExprType))
  in
    foldl (addForeignType moduleName) withDefinitions foreignTypes

addBindTypes :: String -> Map String ExprType -> Bind Ann -> Map String ExprType
addBindTypes moduleName types = case _ of
  NonRec binding -> addBindingType moduleName types binding
  Rec bindings -> Array.foldl (addBindingType moduleName) types bindings

addBindingType :: String -> Map String ExprType -> Binding Ann -> Map String ExprType
addBindingType moduleName types binding@(Binding _ (Ident name) _) =
  case bindingType binding of
    Just ty -> Map.insert (moduleName <> "." <> name) ty types
    Nothing -> types

-- Prefer the binding annotation, then the expression annotation, then the
-- fallback for application results. An explicit Any is preserved.
bindingType :: Binding Ann -> Maybe ExprType
bindingType (Binding (Ann annotation) _ expr) = case annotation.type of
  Just ty -> Just ty
  Nothing -> case getExprAnn expr of
    Ann { type: Just ty } -> Just ty
    _ -> inferExprType expr

addForeignType :: String -> Map String ExprType -> Tuple Ident (Maybe ExprType) -> Map String ExprType
addForeignType moduleName types (Tuple (Ident name) mbType) = case mbType of
  Just ty -> Map.insert (moduleName <> "." <> name) ty types
  Nothing -> types

inferExprType :: Expr Ann -> Maybe ExprType
inferExprType (ExprApp _ fn _) = case getExprAnn fn of
  Ann { type: Just ty } -> getReturnType ty
  _ -> case inferExprType fn of
    Just ty -> getReturnType ty
    Nothing -> Nothing
inferExprType (ExprTypeApp _ fn _) = inferExprType fn
inferExprType _ = Nothing

getReturnType :: ExprType -> Maybe ExprType
getReturnType (ForAll _ ty) = getReturnType ty
getReturnType (ConstrainedType _ ty) = getReturnType ty
getReturnType (Func _ ret) = Just ret
getReturnType _ = Nothing

-- | Specialise every polymorphic global at the types the program uses.
monomorphizeModules :: Map String ExprType -> List (Module Ann) -> List (Module Ann)
monomorphizeModules globalTypes inputModules =
  let
    -- Source identities and usage proofs belong to the exported CoreFn.
    -- Specialisation copies bindings; analyze the final IR afresh instead.
    modules = map invalidateSourceUsageModule inputModules
    -- Keep negate's dictionary until its signed-zero intrinsic is recognized.
    intrinsicGlobals = Set.singleton "Data.Ring.negate"
    -- Thin wrappers over value-level foreign imports gain nothing from
    -- specialization: the FFI boundary is boxed by construction.
    foreignForwarders = collectForeignForwarders modules
    globalAstMap = Map.filterKeys (not <<< flip Set.member intrinsicGlobals) (buildGlobalAstMap modules)
    rawInstantiations = foldl (collectInstantiations globalAstMap) Map.empty modules
    foreignGlobals = Set.union intrinsicGlobals (collectForeignGlobals modules)
    transitiveInstantiations = transitiveCollect globalAstMap rawInstantiations
    -- Only instantiate at call sites that live in the module defining the
    -- global. A cross-module specialisation duplicates code and adds
    -- references that can make the single-crate-per-module layout cyclic,
    -- which cargo rejects.
    instantiations = Map.mapMaybeWithKey keepGlobal
      (Map.filterKeys
        (\name -> not (Set.member name foreignForwarders) && shouldMonomorphize globalTypes foreignGlobals name)
        transitiveInstantiations)
  in
    if Map.isEmpty instantiations then modules
    else map (monomorphize globalAstMap instantiations) modules

definingModule :: String -> String
definingModule qualifiedName =
  String.joinWith "." (Array.dropEnd 1 (String.split (Pattern ".") qualifiedName))

sameModuleInstantiation :: String -> Instantiation -> Boolean
sameModuleInstantiation qualifiedName info =
  Set.size info.callers <= 1 && Set.member (definingModule qualifiedName) info.callers

-- The outer key is the qualified global; inner keys mangle the instantiated
-- type, so the module test must use the outer one.
keepGlobal :: String -> Map String Instantiation -> Maybe (Map String Instantiation)
keepGlobal qualifiedName typeMap =
  let kept = Map.filterWithKey (\_ info -> sameModuleInstantiation qualifiedName info) typeMap
  in if Map.isEmpty kept then Nothing else Just kept

buildGlobalAstMap :: List (Module Ann) -> GlobalAstMap
buildGlobalAstMap = foldl addModuleBindings Map.empty

addModuleBindings :: GlobalAstMap -> Module Ann -> GlobalAstMap
addModuleBindings bindings (Module mod) =
  Array.foldl (addBind (unwrap mod.name)) bindings mod.decls

addBind :: String -> GlobalAstMap -> Bind Ann -> GlobalAstMap
addBind moduleName bindings = case _ of
  NonRec binding -> addBinding moduleName bindings binding
  Rec group -> Array.foldl (addBinding moduleName) bindings group

addBinding :: String -> GlobalAstMap -> Binding Ann -> GlobalAstMap
addBinding moduleName bindings binding@(Binding _ ident _) =
  Map.insert (moduleName <> "." <> unwrap ident) binding bindings

collectForeignGlobals :: List (Module Ann) -> Set String
collectForeignGlobals = foldl addModuleForeignGlobals Set.empty

addModuleForeignGlobals :: Set String -> Module Ann -> Set String
addModuleForeignGlobals globals (Module mod) =
  let
    foreigns = Map.toUnfoldable mod.foreign :: Array (Tuple Ident (Maybe ExprType))
  in
    Array.foldl (addForeignGlobal (unwrap mod.name)) globals foreigns

addForeignGlobal :: String -> Set String -> Tuple Ident (Maybe ExprType) -> Set String
addForeignGlobal moduleName globals (Tuple (Ident name) _) =
  Set.insert (moduleName <> "." <> name) globals

-- Filter only after transitive collection, using the original global type table.
shouldMonomorphize :: Map String ExprType -> Set String -> String -> Boolean
shouldMonomorphize globalTypes foreignGlobals name =
  not (Set.member name foreignGlobals) && case Map.lookup name globalTypes of
    Just ty -> hasTypeVariables ty
    Nothing -> false

-- | Bindings whose body eta-forwards to a foreign import of the same module,
-- | optionally wrapping arguments and result in `unsafeCoerce`. Specializing
-- | such a binding cannot unbox anything across the FFI, so it is skipped.
collectForeignForwarders :: List (Module Ann) -> Set String
collectForeignForwarders = foldl addModuleForwarders Set.empty

addModuleForwarders :: Set String -> Module Ann -> Set String
addModuleForwarders acc (Module mod) =
  let
    moduleName = unwrap mod.name
    foreignIdents = Set.fromFoldable
      (map (\(Tuple (Ident name) _) -> name) (Map.toUnfoldable mod.foreign :: Array (Tuple Ident (Maybe ExprType))))
  in
    Array.foldl (addForwardingBind moduleName foreignIdents) acc mod.decls

addForwardingBind :: String -> Set String -> Set String -> Bind Ann -> Set String
addForwardingBind moduleName foreignIdents acc = case _ of
  NonRec binding -> addForwarder moduleName foreignIdents acc binding
  Rec group -> Array.foldl (addForwarder moduleName foreignIdents) acc group

addForwarder :: String -> Set String -> Set String -> Binding Ann -> Set String
addForwarder moduleName foreignIdents acc (Binding _ (Ident ident) body) =
  if isForeignForwarder moduleName foreignIdents body then
    Set.insert (moduleName <> "." <> ident) acc
  else acc

isForeignForwarder :: String -> Set String -> Expr Ann -> Boolean
isForeignForwarder moduleName foreignIdents body = case collectLambdaParams body of
  { params, body: inner } ->
    not (Array.null params)
      && Set.size (Set.fromFoldable params) == Array.length params
      && case unapplyExpr inner of
        { head: ExprVar _ (Qualified mbModule (Ident ffi)), args } ->
          Set.member ffi foreignIdents
            && sameModule mbModule
            && (mbModule /= Nothing || not (Array.elem (Ident ffi) params))
            && Array.length args == Array.length params
            && foldl (&&) true (Array.zipWith isParameterReference args params)
        _ -> false
  where
  sameModule = case _ of
    Just mn -> unwrap mn == moduleName
    Nothing -> true

collectLambdaParams :: Expr Ann -> { params :: Array Ident, body :: Expr Ann }
collectLambdaParams (ExprAbs _ param body) =
  case collectLambdaParams body of
    rest -> rest { params = Array.cons param rest.params }
collectLambdaParams body = { params: [], body }

unapplyExpr :: Expr Ann -> { head :: Expr Ann, args :: Array (Expr Ann) }
unapplyExpr expr = case stripCoercions expr of
  ExprApp _ fn arg ->
    case unapplyExpr fn of
      inner -> inner { args = Array.snoc inner.args arg }
  other -> { head: other, args: [] }

stripCoercions :: Expr Ann -> Expr Ann
stripCoercions expr = case expr of
  ExprTypeApp _ inner _ -> stripCoercions inner
  ExprApp _ fn arg | isUnsafeCoerce fn -> stripCoercions arg
  _ -> expr

-- `unsafeCoerce` is polymorphic, so its use is wrapped in type applications.
isUnsafeCoerce :: Expr Ann -> Boolean
isUnsafeCoerce fn = case stripTypeApps fn of
  ExprVar _ (Qualified (Just moduleName) (Ident "unsafeCoerce")) -> unwrap moduleName == "Unsafe.Coerce"
  _ -> false

stripTypeApps :: Expr Ann -> Expr Ann
stripTypeApps (ExprTypeApp _ inner _) = stripTypeApps inner
stripTypeApps expr = expr

isParameterReference :: Expr Ann -> Ident -> Boolean
isParameterReference expr (Ident name) = case stripCoercions expr of
  ExprVar _ (Qualified Nothing (Ident used)) -> used == name
  _ -> false

hasTypeVariables :: ExprType -> Boolean
hasTypeVariables (TypeVar v) = String.take 1 v == String.toLower (String.take 1 v)

hasTypeVariables (Func args ret) = Array.any hasTypeVariables args || hasTypeVariables ret
hasTypeVariables (Array t) = hasTypeVariables t
hasTypeVariables (Record row) = hasTypeVariables row
hasTypeVariables (Row props tail) =
  let tailHas = case tail of
        Nothing -> false
        Just t -> hasTypeVariables t
  in Array.any (\(Tuple _ v) -> hasTypeVariables v) props || tailHas
hasTypeVariables (TypeApp c args) = hasTypeVariables c || Array.any hasTypeVariables args
hasTypeVariables (ForAll _ body) = hasTypeVariables body
hasTypeVariables (ConstrainedType constraints body) = Array.any (\(Tuple _ a) -> Array.any hasTypeVariables a) constraints || hasTypeVariables body
hasTypeVariables Int = false
hasTypeVariables String = false
hasTypeVariables Char = false
hasTypeVariables Number = false
hasTypeVariables Boolean = false
hasTypeVariables Unit = false
hasTypeVariables (TypeLevelString _) = false
hasTypeVariables (ADT _ _ args) = Array.any hasTypeVariables args
hasTypeVariables Any = false
