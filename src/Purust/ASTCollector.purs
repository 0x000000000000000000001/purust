module Purust.ASTCollector where

import Prelude
import Data.Set as Set
import Data.Array as Array
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Literal(..), Prop(..), CaseAlternative(..), CaseGuard(..), Guard(..), Binder(..))

collectFieldsModule :: forall a. Module a -> Set.Set String
collectFieldsModule (Module m) =
  Array.foldl (\acc b -> Set.union acc (collectFieldsBind b)) Set.empty m.decls

collectFieldsBind :: forall a. Bind a -> Set.Set String
collectFieldsBind = case _ of
  NonRec (Binding _ _ expr) -> collectFieldsExpr expr
  Rec bindings -> Array.foldl (\acc (Binding _ _ expr) -> Set.union acc (collectFieldsExpr expr)) Set.empty bindings

collectFieldsExpr :: forall a. Expr a -> Set.Set String
collectFieldsExpr = case _ of
  ExprVar _ _ -> Set.empty
  ExprLit _ lit -> collectFieldsLiteral collectFieldsExpr lit
  ExprConstructor _ _ _ _ -> Set.empty
  ExprAccessor _ expr prop -> Set.insert prop (collectFieldsExpr expr)
  ExprUpdate _ expr props -> Set.union (collectFieldsExpr expr) (Array.foldl (\acc (Prop k v) -> Set.insert k (Set.union acc (collectFieldsExpr v))) Set.empty props)
  ExprAbs _ _ expr -> collectFieldsExpr expr
  ExprApp _ e1 e2 -> Set.union (collectFieldsExpr e1) (collectFieldsExpr e2)
  ExprCase _ exprs alts -> Set.union
    (Array.foldl (\acc e -> Set.union acc (collectFieldsExpr e)) Set.empty exprs)
    (Array.foldl (\acc alt -> Set.union acc (collectFieldsCaseAlt alt)) Set.empty alts)
  ExprLet _ binds expr -> Set.union
    (Array.foldl (\acc b -> Set.union acc (collectFieldsBind b)) Set.empty binds)
    (collectFieldsExpr expr)

collectFieldsLiteral :: forall t. (t -> Set.Set String) -> Literal t -> Set.Set String
collectFieldsLiteral f = case _ of
  LitArray arr -> Array.foldl (\acc v -> Set.union acc (f v)) Set.empty arr
  LitRecord props -> Array.foldl (\acc (Prop k v) -> Set.insert k (Set.union acc (f v))) Set.empty props
  _ -> Set.empty

collectFieldsCaseAlt :: forall a. CaseAlternative a -> Set.Set String
collectFieldsCaseAlt (CaseAlternative binders guard) = Set.union
  (Array.foldl (\acc b -> Set.union acc (collectFieldsBinder b)) Set.empty binders)
  (collectFieldsCaseGuard guard)

collectFieldsCaseGuard :: forall a. CaseGuard a -> Set.Set String
collectFieldsCaseGuard = case _ of
  Unconditional expr -> collectFieldsExpr expr
  Guarded guards -> Array.foldl (\acc (Guard e1 e2) -> Set.union acc (Set.union (collectFieldsExpr e1) (collectFieldsExpr e2))) Set.empty guards

collectFieldsBinder :: forall a. Binder a -> Set.Set String
collectFieldsBinder = case _ of
  BinderNull _ -> Set.empty
  BinderVar _ _ -> Set.empty
  BinderNamed _ _ b -> collectFieldsBinder b
  BinderLit _ lit -> collectFieldsLiteral collectFieldsBinder lit
  BinderConstructor _ _ _ binders -> Array.foldl (\acc b -> Set.union acc (collectFieldsBinder b)) Set.empty binders
