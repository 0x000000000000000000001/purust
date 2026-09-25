module Purust.ASTCollector where

import Prelude
import Data.Set as Set
import Data.Foldable (foldMap)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Array as Array
import Data.String as String
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Literal(..), Prop(..), CaseAlternative(..), CaseGuard(..), Guard(..), Binder(..), Qualified(..), ModuleName(..), ExprType(..), Ann(..))

-- A record shape occurrence records the labels in the order the source wrote
-- them, together with where that order comes from. A record literal enumerates
-- in its own label order (the one JavaScript `Object.keys` observes); a type
-- annotation only supplies a candidate order for values built without one.
type ShapeOccurrence = { literal :: Boolean, shape :: String }

typeShape :: String -> ShapeOccurrence
typeShape shape = { literal: false, shape }

collectRecordShapesType :: ExprType -> Array ShapeOccurrence
collectRecordShapesType = case _ of
  Record (Row fields _) ->
    -- A TAST row can repeat a label (record updates and row unions); the Rust
    -- struct must keep one field per label.
    let shape = Array.nub (map (\(Tuple k _) -> k) fields)
    in Array.cons (typeShape (String.joinWith "," shape))
         (foldMap (\(Tuple _ v) -> collectRecordShapesType v) fields)
  ADT _ _ args -> foldMap collectRecordShapesType args
  TypeApp fn args -> collectRecordShapesType fn <> foldMap collectRecordShapesType args
  Func args ret -> collectRecordShapesType ret <> foldMap collectRecordShapesType args
  Array elem -> collectRecordShapesType elem
  _ -> []

getTy :: Ann -> ExprType
getTy (Ann a) = fromMaybe Any a.type

collectRecordShapesExpr :: Expr Ann -> Array ShapeOccurrence
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
  in tyShapes <> case expr of
      ExprVar _ _ -> []
      ExprLit _ lit -> collectRecordShapesLiteral true collectRecordShapesExpr lit
      ExprConstructor _ _ _ _ -> []
      ExprAccessor _ e _ -> collectRecordShapesExpr e
      ExprTypeApp _ e _ -> collectRecordShapesExpr e
      ExprUpdate _ e props -> collectRecordShapesExpr e <> foldMap (\(Prop _ v) -> collectRecordShapesExpr v) props
      ExprAbs _ _ e -> collectRecordShapesExpr e
      ExprApp _ e1 e2 -> collectRecordShapesExpr e1 <> collectRecordShapesExpr e2
      ExprCase _ exprs alts ->
        foldMap collectRecordShapesExpr exprs <> foldMap collectRecordShapesCaseAlt alts
      ExprLet _ binds e ->
        foldMap collectRecordShapesBind binds <> collectRecordShapesExpr e

collectRecordShapesLiteral :: forall t. Boolean -> (t -> Array ShapeOccurrence) -> Literal t -> Array ShapeOccurrence
collectRecordShapesLiteral literal f = case _ of
  LitArray arr -> foldMap f arr
  LitRecord props ->
    let
      labels = Array.nub (map (\(Prop k _) -> k) props)
      own = if Array.null labels then [] else [ { literal, shape: String.joinWith "," labels } ]
    in own <> foldMap (\(Prop _ v) -> f v) props
  _ -> []

collectRecordShapesCaseAlt :: CaseAlternative Ann -> Array ShapeOccurrence
collectRecordShapesCaseAlt (CaseAlternative binders guard) =
  foldMap collectRecordShapesBinder binders <> collectRecordShapesCaseGuard guard

collectRecordShapesCaseGuard :: CaseGuard Ann -> Array ShapeOccurrence
collectRecordShapesCaseGuard = case _ of
  Unconditional expr -> collectRecordShapesExpr expr
  Guarded guards -> foldMap (\(Guard e1 e2) -> collectRecordShapesExpr e1 <> collectRecordShapesExpr e2) guards

collectRecordShapesBinder :: Binder Ann -> Array ShapeOccurrence
collectRecordShapesBinder = case _ of
  BinderNull ty -> collectRecordShapesType (getTy ty)
  BinderVar ty _ -> collectRecordShapesType (getTy ty)
  BinderNamed ty _ b -> collectRecordShapesType (getTy ty) <> collectRecordShapesBinder b
  -- A record pattern tests a value; it does not establish an enumeration order.
  BinderLit ty lit -> collectRecordShapesType (getTy ty) <> collectRecordShapesLiteral false collectRecordShapesBinder lit
  BinderConstructor ty _ _ binders -> collectRecordShapesType (getTy ty) <> foldMap collectRecordShapesBinder binders

collectRecordShapesBind :: Bind Ann -> Array ShapeOccurrence
collectRecordShapesBind = case _ of
  NonRec (Binding _ _ expr) -> collectRecordShapesExpr expr
  Rec bindings -> foldMap (\(Binding _ _ expr) -> collectRecordShapesExpr expr) bindings

collectRecordShapesModule :: Module Ann -> Array ShapeOccurrence
collectRecordShapesModule (Module m) = foldMap collectRecordShapesBind m.decls

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
