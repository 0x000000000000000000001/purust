module Purust.DataLayout (ValueEnums, isNullaryEnum, valueEnumsForModule, valueEnumsForModules, isValueEnum) where

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

-- Eligibility comes from the TAST declaration, independently of constructor
-- names or uses. Empty declarations stay on the existing layout path.
isNullaryEnum :: DataDecl -> Boolean
isNullaryEnum decl =
  not (Array.null decl.constructors) && all (Array.null <<< _.fields) decl.constructors
