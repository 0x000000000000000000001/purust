module Purust.ASTCollector where

import Prelude
import Data.Set as Set
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Array as Array
import Data.String as String
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Literal(..), Prop(..), CaseAlternative(..), CaseGuard(..), Guard(..), Binder(..), Qualified(..), ModuleName(..), ExprType(..), Ann(..))

collectRecordShapesType :: ExprType -> Set.Set String
collectRecordShapesType = case _ of
  Record (Row fields _) ->
    let shape = Array.sortBy compare (map (\(Tuple k _) -> k) fields)
    in Set.insert (String.joinWith "," shape) (Array.foldl (\acc (Tuple _ v) -> Set.union acc (collectRecordShapesType v)) Set.empty fields)
  ADT _ _ args -> Array.foldl (\acc v -> Set.union acc (collectRecordShapesType v)) Set.empty args
  TypeApp fn args -> Set.union (collectRecordShapesType fn) (Array.foldl (\acc v -> Set.union acc (collectRecordShapesType v)) Set.empty args)
  Func args ret -> Set.union (collectRecordShapesType ret) (Array.foldl (\acc v -> Set.union acc (collectRecordShapesType v)) Set.empty args)
  Array elem -> collectRecordShapesType elem
  _ -> Set.empty

getTy :: Ann -> ExprType
getTy (Ann a) = fromMaybe Any a.type

collectRecordShapesExpr :: Expr Ann -> Set.Set String
collectRecordShapesExpr expr =
  let
    tyShapes = case expr of
      ExprVar ty _ -> collectRecordShapesType (getTy ty)
      ExprLit ty _ -> collectRecordShapesType (getTy ty)
      ExprConstructor ty _ _ _ -> collectRecordShapesType (getTy ty)
      ExprAccessor ty _ _ -> collectRecordShapesType (getTy ty)
      ExprUpdate ty _ _ -> collectRecordShapesType (getTy ty)
      ExprAbs ty _ _ -> collectRecordShapesType (getTy ty)
      ExprTypeApp ty _ _ -> collectRecordShapesType (getTy ty)
      ExprApp ty _ _ -> collectRecordShapesType (getTy ty)
      ExprCase ty _ _ -> collectRecordShapesType (getTy ty)
      ExprLet ty _ _ -> collectRecordShapesType (getTy ty)
  in Set.union tyShapes (case expr of
      ExprVar _ _ -> Set.empty
      ExprLit _ lit -> collectRecordShapesLiteral collectRecordShapesExpr lit
      ExprConstructor _ _ _ _ -> Set.empty
      ExprAccessor _ e _ -> collectRecordShapesExpr e
      ExprTypeApp _ e _ -> collectRecordShapesExpr e
      ExprUpdate _ e props -> Set.union (collectRecordShapesExpr e) (Array.foldl (\acc (Prop _ v) -> Set.union acc (collectRecordShapesExpr v)) Set.empty props)
      ExprAbs _ _ e -> collectRecordShapesExpr e
      ExprApp _ e1 e2 -> Set.union (collectRecordShapesExpr e1) (collectRecordShapesExpr e2)
      ExprCase _ exprs alts -> Set.union
        (Array.foldl (\acc e -> Set.union acc (collectRecordShapesExpr e)) Set.empty exprs)
        (Array.foldl (\acc alt -> Set.union acc (collectRecordShapesCaseAlt alt)) Set.empty alts)
      ExprLet _ binds e -> Set.union
        (Array.foldl (\acc b -> Set.union acc (collectRecordShapesBind b)) Set.empty binds)
        (collectRecordShapesExpr e)
  )

collectRecordShapesLiteral :: forall t. (t -> Set.Set String) -> Literal t -> Set.Set String
collectRecordShapesLiteral f = case _ of
  LitArray arr -> Array.foldl (\acc v -> Set.union acc (f v)) Set.empty arr
  LitRecord props -> Array.foldl (\acc (Prop _ v) -> Set.union acc (f v)) Set.empty props
  _ -> Set.empty

collectRecordShapesCaseAlt :: CaseAlternative Ann -> Set.Set String
collectRecordShapesCaseAlt (CaseAlternative binders guard) = Set.union
  (Array.foldl (\acc b -> Set.union acc (collectRecordShapesBinder b)) Set.empty binders)
  (collectRecordShapesCaseGuard guard)

collectRecordShapesCaseGuard :: CaseGuard Ann -> Set.Set String
collectRecordShapesCaseGuard = case _ of
  Unconditional expr -> collectRecordShapesExpr expr
  Guarded guards -> Array.foldl (\acc (Guard e1 e2) -> Set.union acc (Set.union (collectRecordShapesExpr e1) (collectRecordShapesExpr e2))) Set.empty guards

collectRecordShapesBinder :: Binder Ann -> Set.Set String
collectRecordShapesBinder = case _ of
  BinderNull ty -> collectRecordShapesType (getTy ty)
  BinderVar ty _ -> collectRecordShapesType (getTy ty)
  BinderNamed ty _ b -> Set.union (collectRecordShapesType (getTy ty)) (collectRecordShapesBinder b)
  BinderLit ty lit -> Set.union (collectRecordShapesType (getTy ty)) (collectRecordShapesLiteral collectRecordShapesBinder lit)
  BinderConstructor ty _ _ binders -> Set.union (collectRecordShapesType (getTy ty)) (Array.foldl (\acc b -> Set.union acc (collectRecordShapesBinder b)) Set.empty binders)

collectRecordShapesBind :: Bind Ann -> Set.Set String
collectRecordShapesBind = case _ of
  NonRec (Binding _ _ expr) -> collectRecordShapesExpr expr
  Rec bindings -> Array.foldl (\acc (Binding _ _ expr) -> Set.union acc (collectRecordShapesExpr expr)) Set.empty bindings

collectRecordShapesModule :: Module Ann -> Set.Set String
collectRecordShapesModule (Module m) =
  Array.foldl (\acc b -> Set.union acc (collectRecordShapesBind b)) Set.empty m.decls

collectModulesModule :: forall a. Module a -> Set.Set String
collectModulesModule (Module m) =
  Array.foldl (\acc b -> Set.union acc (collectModulesBind b)) Set.empty m.decls

collectModulesBind :: forall a. Bind a -> Set.Set String
collectModulesBind = case _ of
  NonRec (Binding _ _ expr) -> collectModulesExpr expr
  Rec bindings -> Array.foldl (\acc (Binding _ _ expr) -> Set.union acc (collectModulesExpr expr)) Set.empty bindings

collectModulesExpr :: forall a. Expr a -> Set.Set String
collectModulesExpr = case _ of
  ExprVar _ (Qualified (Just (ModuleName mn)) _) -> Set.singleton mn
  ExprVar _ _ -> Set.empty
  ExprLit _ lit -> collectModulesLiteral collectModulesExpr lit
  ExprConstructor _ _ _ _ -> Set.empty
  ExprTypeApp _ expr _ -> collectModulesExpr expr
  ExprAccessor _ expr _ -> Set.insert "Record.Unsafe" (collectModulesExpr expr)
  ExprUpdate _ expr props -> Set.insert "Record.Unsafe" (Set.union (collectModulesExpr expr) (Array.foldl (\acc (Prop _ v) -> Set.union acc (collectModulesExpr v)) Set.empty props))
  ExprAbs _ _ expr -> collectModulesExpr expr
  ExprApp _ e1 e2 -> Set.union (collectModulesExpr e1) (collectModulesExpr e2)
  ExprCase _ exprs alts -> Set.union
    (Array.foldl (\acc e -> Set.union acc (collectModulesExpr e)) Set.empty exprs)
    (Array.foldl (\acc alt -> Set.union acc (collectModulesCaseAlt alt)) Set.empty alts)
  ExprLet _ binds expr -> Set.union
    (Array.foldl (\acc b -> Set.union acc (collectModulesBind b)) Set.empty binds)
    (collectModulesExpr expr)

collectModulesLiteral :: forall t. (t -> Set.Set String) -> Literal t -> Set.Set String
collectModulesLiteral f = case _ of
  LitArray arr -> Array.foldl (\acc v -> Set.union acc (f v)) Set.empty arr
  LitRecord props -> Array.foldl (\acc (Prop _ v) -> Set.union acc (f v)) Set.empty props
  _ -> Set.empty

collectModulesCaseAlt :: forall a. CaseAlternative a -> Set.Set String
collectModulesCaseAlt (CaseAlternative binders guard) = Set.union
  (Array.foldl (\acc b -> Set.union acc (collectModulesBinder b)) Set.empty binders)
  (collectModulesCaseGuard guard)

collectModulesCaseGuard :: forall a. CaseGuard a -> Set.Set String
collectModulesCaseGuard = case _ of
  Unconditional expr -> collectModulesExpr expr
  Guarded guards -> Array.foldl (\acc (Guard e1 e2) -> Set.union acc (Set.union (collectModulesExpr e1) (collectModulesExpr e2))) Set.empty guards

collectModulesBinder :: forall a. Binder a -> Set.Set String
collectModulesBinder = case _ of
  BinderNull _ -> Set.empty
  BinderVar _ _ -> Set.empty
  BinderNamed _ _ b -> collectModulesBinder b
  BinderLit _ lit -> collectModulesLiteral collectModulesBinder lit
  BinderConstructor _ (Qualified (Just (ModuleName mn)) _) _ binders -> Set.union (Set.singleton mn) (Array.foldl (\acc b -> Set.union acc (collectModulesBinder b)) Set.empty binders)
  BinderConstructor _ _ _ binders -> Array.foldl (\acc b -> Set.union acc (collectModulesBinder b)) Set.empty binders
