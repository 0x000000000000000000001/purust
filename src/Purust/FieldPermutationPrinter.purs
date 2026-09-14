module Purust.FieldPermutationPrinter (permutationFunction) where

import Prelude

import Control.Alternative (guard)
import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.String as String
import Data.String.Pattern (Pattern(..))
import Data.Traversable (traverse)
import PureScript.Backend.Optimizer.CoreFn (ExprType, Ident(..), Qualified(..))
import Purust.ChildBranchPrinter (predicateFunction)
import Purust.ChildBranches (ConstructorInfo)
import Purust.FieldPermutations (FieldPermutation, ScalarValue(..))

-- Every tag/uniqueness check precedes the first write. All scalar sources
-- are copied before any destination changes; only swaps remain afterwards.
-- No opaque payloads or source-language calls enter this mutation window.
permutationFunction
  :: (ExprType -> String)
  -> (String -> String)
  -> (Qualified Ident -> Maybe ConstructorInfo)
  -> Array ExprType
  -> String
  -> FieldPermutation
  -> Maybe String
permutationFunction representation sanitize constructorInfo argTypes name plan = do
  info <- constructorInfo plan.constructor
  native <- String.stripPrefix (Pattern "std::rc::Rc<") (representation info.resultType)
    >>= String.stripSuffix (Pattern ">")
  let Qualified _ (Ident ctorName) = plan.constructor
      ctor = native <> "::" <> sanitize ctorName
      predicateName = name <> "__matches"
      field level index = "_purust_permute_" <> show level <> "_" <> show index
      pattern level = ctor <> "(" <> String.joinWith ", "
        (Array.mapWithIndex (\index _ -> field level index) plan.fields) <> ")"
      temporary index = "_purust_permute_value_" <> show index
      forward level = field level plan.forward
      reverse level = field level plan.reverse
      changedWrites = Array.filter (\write -> case write.value of
        ScalarPath source -> source.level /= write.level || source.index /= write.index
        ScalarConstructor _ -> true) plan.writes
  predicate <- predicateFunction representation sanitize constructorInfo argTypes predicateName plan.predicate
  arguments <- traverse (\index -> field 0 <$> Array.findIndex (_ == index) plan.fieldParams)
    (Array.mapWithIndex (\index _ -> index) argTypes)
  values <- traverse (\write -> case write.value of
    ScalarPath source -> Just ("*" <> field source.level source.index)
    ScalarConstructor qualified@(Qualified _ (Ident name')) -> do
      scalar <- constructorInfo qualified
      guard (Array.null scalar.fields)
      pure (representation scalar.resultType <> "::" <> sanitize name')) changedWrites
  let snapshots = String.joinWith " " (Array.mapWithIndex
        (\index value -> "let " <> temporary index <> " = " <> value <> ";") values)
      writes = String.joinWith " " (Array.mapWithIndex (\index write ->
        "*" <> field write.level write.index <> " = " <> temporary index <> ";") changedWrites)
  pure (predicate <>
    "#[inline]\nfn " <> name <> "(_purust_permute_slot: &mut " <> native <> ") -> bool {\n" <>
    "// purust field permutation: typed fields, exclusive cells, staged scalars\n" <>
    "let " <> pattern 0 <> " = _purust_permute_slot else { return false; };\n" <>
    "if !" <> predicateName <> "(" <> String.joinWith ", " arguments <> ") { return false; }\n" <>
    "{ let std::option::Option::Some(_purust_permute_parent) = std::rc::Rc::get_mut(" <> forward 0 <> ") else { return false; };\n" <>
    "let " <> pattern 1 <> " = _purust_permute_parent else { return false; };\n" <>
    "{ let std::option::Option::Some(_purust_permute_child) = std::rc::Rc::get_mut(" <> forward 1 <> ") else { return false; };\n" <>
    "let " <> pattern 2 <> " = _purust_permute_child else { return false; };\n" <>
    snapshots <> "\n" <> writes <> "\n}\n" <>
    "std::mem::swap(" <> forward 1 <> ", " <> reverse 1 <> ");\n" <>
    "std::mem::swap(" <> reverse 1 <> ", " <> reverse 0 <> ");\n}\n" <>
    "std::mem::swap(" <> forward 0 <> ", " <> reverse 0 <> ");\ntrue\n}\n")
