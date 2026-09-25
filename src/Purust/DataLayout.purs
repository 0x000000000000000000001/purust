module Purust.DataLayout (ValueEnums, isNullaryEnum, valueEnumsForModule, valueEnumsForModules, isValueEnum, isOpaqueForeignType, opaqueForeignTypeKey) where

import Prelude

import Data.Array as Array
import Data.Foldable (class Foldable, all, foldl)
import Data.Newtype (unwrap)
import Data.Set (Set)
import Data.Set as Set
import Data.String as String
import Data.String.Pattern (Pattern(..), Replacement(..))
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (DataDecl, Module(..))

-- Use qualified type names, in the same module namespace as Rust emission.
type ValueEnums = Set (Tuple String String)

moduleKey :: String -> String
moduleKey = String.replaceAll (Pattern ".") (Replacement "_")

valueEnumsForModule :: forall a. Module a -> ValueEnums
valueEnumsForModule (Module mod) =
  Set.fromFoldable $ map (\decl -> Tuple (moduleKey (unwrap mod.name)) decl.name)
    (Array.filter isNullaryEnum mod.dataDecls)

-- All modules, including FFI signatures, must share the same representation.
valueEnumsForModules :: forall f a. Foldable f => f (Module a) -> ValueEnums
valueEnumsForModules = foldl (\acc mod -> Set.union acc (valueEnumsForModule mod)) Set.empty

isValueEnum :: ValueEnums -> String -> String -> Boolean
isValueEnum enums modName typeName = Set.member (Tuple (moduleKey modName) typeName) enums

-- Foreign data types without a native Rust binding have no constructors and no
-- finite layout: values of the type are whatever unsafeCoerce moved in. They
-- share the layout-fact set under a marker that cannot collide with a type
-- name, so code generation maps them to the boxed runtime Value.
opaqueForeignTypeKey :: String -> String -> Tuple String String
opaqueForeignTypeKey modName typeName = Tuple (moduleKey modName) (opaqueForeignTypeMarker <> typeName)

isOpaqueForeignType :: ValueEnums -> String -> String -> Boolean
isOpaqueForeignType enums modName typeName = Set.member (opaqueForeignTypeKey modName typeName) enums

opaqueForeignTypeMarker :: String
opaqueForeignTypeMarker = "$opaque$"

-- Eligibility comes from the TAST declaration, independently of constructor
-- names or uses. Empty declarations stay on the existing layout path.
isNullaryEnum :: DataDecl -> Boolean
isNullaryEnum decl =
  not (Array.null decl.constructors) && all (Array.null <<< _.fields) decl.constructors
