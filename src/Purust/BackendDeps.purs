-- | Exact module dependencies of an optimized backend module.
-- |
-- | The dependency set must describe the generated Rust: a crate is needed
-- | when the emitted code names one of its globals (through a `Purs_X::` path
-- | or a glob import) or one of its types. Deriving it from the pre-codegen
-- | CoreFn AST over-approximates, because optimisation later removes
-- | references, and a spurious edge can make the crate graph cyclic.
-- |
-- | The bindings of a `BackendModule` are already the used ones, so walking
-- | them yields the references that survive into code generation. Type
-- | references are collected only when the type keeps a native representation:
-- | value enums and opaque foreign types lower to `crate::UnknownType`, and the
-- | rest are imported through `use Purs_X::*;` and named unqualified.
module Purust.BackendDeps (backendModuleDeps) where

import Prelude

import Data.Array as Array
import Data.Array.NonEmpty as NonEmptyArray
import Data.Foldable (foldMap)
import Data.Map as Map
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Set (Set)
import Data.Set as Set
import Data.String as String
import Data.String.Pattern (Pattern(..))
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.Convert (BackendModule)
import PureScript.Backend.Optimizer.CoreFn (ExprType, Literal(..), ModuleName(..), Prop(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn as CoreFn
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendOperator(..), BackendSyntax(..), Pair(..))
import Purust.DataLayout (ValueEnums, isOpaqueForeignType, isValueEnum)

backendModuleDeps :: ValueEnums -> BackendModule -> Set String
backendModuleDeps enums mod =
  Set.unions
    [ foldMap groupDeps mod.bindings
    , foldMap (foldMap (exprTypeDeps enums)) (Map.values mod.foreign)
    ]
  where
  groupDeps group = foldMap (\(Tuple _ expr) -> exprDeps enums expr) group.bindings

-- `Data.Maybe.Maybe` names a type of module `Data.Maybe`.
typeModuleName :: String -> String
typeModuleName fqn = String.joinWith "." (Array.dropEnd 1 (String.split (Pattern ".") fqn))

-- The generated code names `Purs_<Module>::<Name>` only for types that keep a
-- native representation.
namesType :: ValueEnums -> String -> String -> Boolean
namesType enums moduleName typeName =
  not (isValueEnum enums moduleName typeName || isOpaqueForeignType enums moduleName typeName)

exprDeps :: ValueEnums -> NeutralExpr -> Set String
exprDeps enums (NeutralExpr expr) = case expr of
  Var (Qualified mbModule _) -> case mbModule of
    Just (ModuleName name) -> Set.singleton name
    Nothing -> Set.empty
  Local _ _ -> Set.empty
  Lit lit -> literalDeps enums lit
  App fn args -> exprDeps enums fn <> foldMap (exprDeps enums) (NonEmptyArray.toArray args)
  TypeApp inner ty -> exprDeps enums inner <> exprTypeDeps enums ty
  Abs _ body -> exprDeps enums body
  UncurriedApp fn args -> exprDeps enums fn <> foldMap (exprDeps enums) args
  UncurriedAbs _ body -> exprDeps enums body
  UncurriedEffectApp fn args -> exprDeps enums fn <> foldMap (exprDeps enums) args
  UncurriedEffectAbs _ body -> exprDeps enums body
  Accessor base _ -> exprDeps enums base
  Update base props -> exprDeps enums base <> foldMap (\(Prop _ value) -> exprDeps enums value) props
  CtorSaturated _ _ _ _ fields -> foldMap (\(Tuple _ value) -> exprDeps enums value) fields
  CtorDef _ _ _ _ -> Set.empty
  LetRec _ binds body -> exprDeps enums body <> foldMap (\(Tuple _ value) -> exprDeps enums value) (NonEmptyArray.toArray binds)
  Let _ _ value body -> exprDeps enums value <> exprDeps enums body
  EffectBind _ _ value body -> exprDeps enums value <> exprDeps enums body
  EffectPure value -> exprDeps enums value
  EffectDefer inner -> exprDeps enums inner
  Branch branches def ->
    foldMap (\(Pair cond body) -> exprDeps enums cond <> exprDeps enums body) (NonEmptyArray.toArray branches)
      <> exprDeps enums def
  PrimOp operator -> case operator of
    Op1 _ a -> exprDeps enums a
    Op2 _ a b -> exprDeps enums a <> exprDeps enums b
  PrimEffect operation -> foldMap (exprDeps enums) operation
  Typed ty inner -> exprDeps enums inner <> exprTypeDeps enums ty
  PrimUndefined -> Set.empty
  Fail _ -> Set.empty

literalDeps :: ValueEnums -> Literal NeutralExpr -> Set String
literalDeps enums = case _ of
  LitArray values -> foldMap (exprDeps enums) values
  LitRecord props -> foldMap (\(Prop _ value) -> exprDeps enums value) props
  _ -> Set.empty

exprTypeDeps :: ValueEnums -> ExprType -> Set String
exprTypeDeps enums = case _ of
  CoreFn.ADT fqn parts args ->
    let moduleName = typeModuleName fqn
        typeName = fromMaybe "" (Array.last parts)
        needed = not (String.null moduleName) && namesType enums moduleName typeName
    in if needed then Set.insert moduleName (foldMap (exprTypeDeps enums) args)
       else foldMap (exprTypeDeps enums) args
  CoreFn.Array ty -> exprTypeDeps enums ty
  CoreFn.TypeApp ty args -> exprTypeDeps enums ty <> foldMap (exprTypeDeps enums) args
  CoreFn.Func args ret -> foldMap (exprTypeDeps enums) args <> exprTypeDeps enums ret
  CoreFn.Record row -> exprTypeDeps enums row
  CoreFn.Row props tailRow -> foldMap (\(Tuple _ value) -> exprTypeDeps enums value) props <> foldMap (exprTypeDeps enums) tailRow
  CoreFn.ForAll _ ty -> exprTypeDeps enums ty
  CoreFn.ConstrainedType constraints ty -> foldMap (\(Tuple _ args) -> foldMap (exprTypeDeps enums) args) constraints <> exprTypeDeps enums ty
  _ -> Set.empty
