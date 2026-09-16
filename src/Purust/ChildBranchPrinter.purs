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

data Decision
  = Result Boolean
  | Test TagPath (Qualified Ident) Decision Decision

derive instance Eq Decision

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
  -- Validate every original path, including paths later removed as redundant.
  fallback <- emit predicate
  let body = case decision [] [] 128 predicate >>= (printDecision <<< _.tree) of
        Just result -> result
        Nothing -> fallback
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

  -- A constructor test establishes borrowed names for its fields only in the
  -- matching arm. Facts and names are scoped together; no projection is moved
  -- across the ordered condition which makes it valid.
  boundCode bindings path = case Array.unsnoc path.steps of
    Nothing -> Just (argument path.parameter)
    Just { init, last: step } -> do
      parent <- Array.find (\bound -> bound.path.parameter == path.parameter
        && bound.path.steps == init && bound.constructor == step.constructor) bindings
      Array.index parent.fields step.index

  simplify facts = case _ of
    Constant value -> Constant value
    tag@(IsTag path qualified) -> case Array.find (\fact -> fact.path == path
      && (fact.matches || fact.constructor == qualified)) facts of
      Just fact | not fact.matches -> Constant false
      -- Unqualified and current-module names can denote the same native
      -- variant. Only their validated native identities establish disjointness.
      Just fact -> case constructor fact.constructor, constructor qualified of
        Just actual, Just expected -> Constant (actual.code == expected.code)
        _, _ -> tag
      Nothing -> tag
    If condition yes no -> case simplify facts condition of
      Constant true -> simplify facts yes
      Constant false -> simplify facts no
      other -> case simplify facts yes, simplify facts no of
        Constant true, Constant true -> Constant true
        Constant false, Constant false -> Constant false
        y, n -> If other y n

  firstTag = case _ of
    IsTag path qualified -> Just { path, qualified }
    If condition _ _ -> firstTag condition
    Constant _ -> Nothing

  -- Shannon expansion starts at the first unresolved test in evaluation
  -- order. The budget counts all emitted matches, not just recursion depth.
  -- Large predicates retain the original short-circuit printer.
  decision facts bindings remaining original = case simplify facts original of
    Constant value -> Just { tree: Result value, remaining }
    reduced -> do
      guard (remaining > 0)
      { path, qualified } <- firstTag reduced
      _ <- boundCode bindings path
      ctor <- constructor qualified
      let fields = Array.mapWithIndex (\i _ -> "_purust_guard_bound_" <> show remaining <> "_" <> show i) ctor.info.fields
          bound = { path, constructor: qualified, fields }
          fact matches = { path, constructor: qualified, matches }
      yes <- decision (Array.cons (fact true) facts) (Array.cons bound bindings) (remaining - 1) reduced
      no <- decision (Array.cons (fact false) facts) bindings yes.remaining reduced
      pure { tree: Test path qualified yes.tree no.tree, remaining: no.remaining }

  decisionSize = case _ of
    Result _ -> 0
    Test _ _ yes no -> 1 + decisionSize yes + decisionSize no

  decisions tree = case tree of
    Result _ -> []
    Test _ _ yes no -> Array.cons tree (decisions yes <> decisions no)

  occurrences wanted tree | wanted == tree = 1
  occurrences wanted (Test _ _ yes no) = occurrences wanted yes + occurrences wanted no
  occurrences _ _ = 0

  -- A repeated continuation may move outside its predecessors only when it
  -- needs no names established inside them. A labeled block shares that suffix
  -- without closures or eager projections; other leaves return immediately.
  printDecision tree = chooseShared (Array.sortBy (\a b -> compare (decisionSize b) (decisionSize a))
    (Array.filter (\candidate -> occurrences candidate tree > 1) (Array.nubEq (decisions tree))))
    where
    chooseShared candidates = case Array.uncons candidates of
      Nothing -> emitDecision [] Nothing tree
      Just { head: shared, tail } -> case emitDecision [] Nothing shared of
        Nothing -> chooseShared tail
        Just continuation -> do
          prefix <- emitDecision [] (Just shared) tree
          pure ("'_purust_guard_tail: { " <> prefix <> " } " <> continuation)

  emitDecision _ stopped tree
    | stopped == Just tree = Just "break '_purust_guard_tail;"
  emitDecision _ _ (Result value) = Just ("return " <> (if value then "true" else "false") <> ";")
  emitDecision bindings stopped tree@(Test path qualified yes no) = do
    code <- boundCode bindings path
    ctor <- constructor qualified
    let fields = Array.mapWithIndex (\i _ -> "_purust_guard_bound_" <> show (decisionSize tree) <> "_" <> show i) ctor.info.fields
        bound = { path, constructor: qualified, fields }
        pattern = ctor.code <> if Array.null fields then "" else "(" <> String.joinWith ", " fields <> ")"
    y <- emitDecision (Array.cons bound bindings) stopped yes
    n <- emitDecision bindings stopped no
    pure ("match " <> receiver path.finalType code <> " { " <> pattern <> " => { " <> y <>
      " }, _ => { " <> n <> " } }")

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
