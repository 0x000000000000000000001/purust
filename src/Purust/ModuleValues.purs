module Purust.ModuleValues (eligibleValues, memoizedBody, runtime) where

import Prelude
import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Set (Set)
import Data.Set as Set
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (Ann(..), Bind(..), Binding(..), Expr(..), ExprType(..), Ident, Module(..))

-- Eligibility comes from original typed declarations, not Rust's nullary ABI.
-- Recursive groups, functions, constructors and polymorphism are deliberately
-- outside this first module-sharing contract.
eligibleValues :: Module Ann -> Set Ident
eligibleValues (Module m) = Set.fromFoldable (Array.mapMaybe eligible m.decls)
  where
  eligible (NonRec (Binding (Ann ann) ident expr)) = case ann.type, expr of
    _, ExprConstructor _ _ _ _ -> Nothing
    _, ExprAbs _ _ _ -> Nothing
    Just (Func _ _), _ -> Nothing
    Just ty, _ | closed ty -> Just ident
    _, _ -> Nothing
  eligible _ = Nothing

closed :: ExprType -> Boolean
closed = case _ of
  Any -> false
  TypeVar _ -> false
  ForAll _ _ -> false
  ConstrainedType _ _ -> false
  Array ty -> closed ty
  ADT _ _ args -> Array.all closed args
  TypeApp ty args -> closed ty && Array.all closed args
  Func args ret -> Array.all closed args && closed ret
  Row fields Nothing -> Array.all (\(Tuple _ ty) -> closed ty) fields
  Row _ (Just _) -> false
  Record row -> closed row
  _ -> true

memoizedBody :: Boolean -> String -> String -> String -> String
memoizedBody threaded name ty body =
  let
    cell = "purust_core::module_values::Cell<" <> ty <> ">"
    get = "slot.get_or_init(\"" <> name <> "\", || {\n" <> body <> "\n}).clone()"
  in if threaded then
    "static __PURUST_MODULE_VALUE: " <> cell <> " = purust_core::module_values::Cell::new();\n"
      <> "let slot = &__PURUST_MODULE_VALUE;\n" <> get
  else
    "std::thread_local! { static __PURUST_MODULE_VALUE: " <> cell
      <> " = const { purust_core::module_values::Cell::new() }; }\n"
      <> "__PURUST_MODULE_VALUE.with(|slot| " <> get <> ")"

foreign import runtime :: String
