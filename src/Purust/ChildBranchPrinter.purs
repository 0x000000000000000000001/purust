module Purust.ChildBranchPrinter (predicateFunction) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Foldable (foldM)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.String as String
import Data.String.Pattern (Pattern(..))
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), Qualified(..))
import Purust.ChildBranches (ConstructorInfo, Predicate(..), TagPath)

-- Predicates borrow native fields. The analysis has already established the
-- dominating constructor tests that make each projection safe to evaluate.
predicateFunction
  :: (ExprType -> String)
  -> (String -> String)
  -> (Qualified Ident -> Maybe ConstructorInfo)
  -> Array ExprType
  -> String
  -> Predicate
  -> Maybe String
predicateFunction representation sanitize constructorInfo argTypes name predicate = do
  body <- emit predicate
  let params = Array.mapWithIndex (\i ty -> argument i <> ": &" <> representation ty) argTypes
  pure ("#[inline]\nfn " <> name <> "(" <> String.joinWith ", " params <> ") -> bool { " <> body <> " }\n")
  where
  argument i = "_purust_guard_arg_" <> show i

  pointee ty = String.stripPrefix (Pattern "std::rc::Rc<") (representation ty)
    >>= String.stripSuffix (Pattern ">")

  receiver ty code = case pointee ty of
    Just _ -> "(" <> code <> ").as_ref()"
    Nothing -> code

  constructor qualified@(Qualified _ (Ident ctor)) = do
    info <- constructorInfo qualified
    let native = fromMaybe (representation info.resultType) (pointee info.resultType)
    pure { code: native <> "::" <> sanitize ctor, info }

  pathCode :: TagPath -> Maybe String
  pathCode path = do
    ty <- Array.index argTypes path.parameter
    result <- foldM (\current step -> do
      ctor <- constructor step.constructor
      guard (representation current.ty == representation ctor.info.resultType)
      guard (Array.length ctor.info.fields == step.width)
      fieldType <- Array.index ctor.info.fields step.index
      guard (representation fieldType == representation step.fieldType)
      let fields = Array.mapWithIndex (\i _ -> if i == step.index then "_purust_guard_field" else "_") ctor.info.fields
          code = "(match " <> receiver current.ty current.code <> " { " <> ctor.code <>
            "(" <> String.joinWith ", " fields <> ") => _purust_guard_field, _ => unreachable!() })"
      pure { ty: fieldType, code }) { ty, code: argument path.parameter } path.steps
    guard (representation result.ty == representation path.finalType)
    pure result.code

  emit (Constant value) = Just (if value then "true" else "false")
  emit (IsTag path qualified) = do
    code <- pathCode path
    ctor <- constructor qualified
    guard (representation path.finalType == representation ctor.info.resultType)
    let pattern = ctor.code <> if Array.null ctor.info.fields then "" else "(..)"
    pure ("matches!(" <> receiver path.finalType code <> ", " <> pattern <> ")")
  emit (If condition yes no) = do
    c <- emit condition
    y <- emit yes
    n <- emit no
    pure case yes, no of
      Constant true, Constant false -> c
      Constant false, Constant true -> "!(" <> c <> ")"
      Constant false, _ -> "!(" <> c <> ") && (" <> n <> ")"
      _, Constant false -> "(" <> c <> ") && (" <> y <> ")"
      Constant true, _ -> "(" <> c <> ") || (" <> n <> ")"
      _, Constant true -> "!(" <> c <> ") || (" <> y <> ")"
      _, _ -> "if " <> c <> " { " <> y <> " } else { " <> n <> " }"
