module Purust.CodeGen (codegenModule, codegenModuleWithValueEnums, codegenModuleWithOptions, codegenPrelude, codegenPreludeWithRenames, fieldRenames, sanitizeIdent, getArity, extractAllArgTypes, extractFinalRetType, codegenExprType, codegenExprTypeWithValueEnums) where
import Debug as Debug


import Prelude
import Control.Alternative (guard)
import PureScript.Backend.Optimizer.Syntax (BackendSyntax(..), BackendAccessor(..), BackendOperator(..), BackendOperator1(..), BackendOperator2(..), BackendOperatorNum(..), BackendOperatorOrd(..), BackendEffect(..), Pair(..), Level(..))
import PureScript.Backend.Optimizer.Syntax as Syn
import PureScript.Backend.Optimizer.Convert (BackendModule, BackendBindingGroup)
import Debug as Debug
import Effect (Effect)
import Effect.Console (log)
import Effect.Unsafe (unsafePerformEffect)
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..), DataTypeMeta, CtorMeta)
import Purust.LocalNames (renameLocals)
import Purust.ModuleValues as ModuleValues
import Purust.RecordFields as RecordFields
import Purust.ShareNullaries (shareNullaries, reuseNullaries)
import Purust.ReturnCells (rewriteReturns, reuseNestedConstructor)
import Purust.OwnedFields (OwnedFields, fieldSources, projectionChain, rewriteFields)
import Purust.ReuseFields (scalarFieldUpdate)
import Purust.ChildCalls as ChildCalls
import Purust.ChildBranches as ChildBranches
import Purust.FieldPermutations (fieldPermutation)
import Purust.FieldPermutationPrinter (permutationFunction)
import Purust.RecordBorrows (recordProjection)
import Purust.ChildBranchPrinter (predicateFunction)
import Purust.ChildUpdates (childUpdate)
import Purust.RecordUpdates (RecordUpdate(..), RecordReplacement(..), recordUpdate)
import Purust.ClassFields (superclassFields)
import Purust.DataLayout (ValueEnums, isValueEnum, isOpaqueForeignType)
import Purust.ThunkFusion (optimizeThunkProducers)
import Purust.RecordScalarization (optimizeRecordLoops)
import Purust.FunctionFusion (countedFunctionProducers)
import Purust.Utf16 (runtimeHelpers, rustStringLiteral, rustCharLiteral)
import PureScript.Backend.Optimizer.CoreFn (Ann, ClassDecl, Expr(..), ExprType(..), Ident(..), Literal(..), Module(..), ModuleName(..), ProperName(..), Prop(..), Qualified(..))
import PureScript.Backend.Optimizer.CoreFn as CoreFn
import Debug as Debug
import Data.String as String
import Data.String.CodeUnits as SCU
import Data.Array as Array
import Data.Array.NonEmpty as NonEmptyArray
import Data.Foldable (foldMap)
import Data.Traversable (traverse)
import Data.Newtype (unwrap)
import Data.Maybe (Maybe(..))
import Data.Tuple (Tuple(..))
import Data.Set (Set)
import Data.Set as Set
import Data.Map (Map)
import Data.Map as Map
import Data.String.Pattern (Pattern(..), Replacement(..))
import Data.Maybe (Maybe(..), fromMaybe, isJust, isNothing)
import Partial.Unsafe (unsafeCrashWith)
import Effect.Ref as Ref
import Effect.Console (log)
import Effect.Unsafe (unsafePerformEffect)

-- Includes the twelve arguments in the observed VariantF traversal path.
maxNativeFunctionArity :: Int
maxNativeFunctionArity = 12

-- Monomorphic array traversals for call sites whose callback and element
-- representation are statically known. The caller instantiates the generic
-- helper with a concrete closure, so the boxed callback layer and the boxed
-- accumulator disappear once the loop is inlined.
-- Element representations and the two-representation array view. These live
-- at the crate root so generated modules and FFI files can name them.
reprItemsSource :: String
reprItemsSource = "pub trait Repr: Sized + Clone {\n" <>
  "    fn from_value(value: &Value) -> Self;\n" <>
  "    fn from_int(value: i64) -> Self;\n" <>
  "    fn into_value(self) -> Value;\n" <>
  "}\n" <>
  "impl Repr for Value {\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_value(value: &Value) -> Value { value.clone() }\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_int(value: i64) -> Value { Value::Int(value) }\n" <>
  "    #[inline(always)]\n" <>
  "    fn into_value(self) -> Value { self }\n" <>
  "}\n" <>
  "impl Repr for i64 {\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_value(value: &Value) -> i64 { value.unwrap_int() }\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_int(value: i64) -> i64 { value }\n" <>
  "    #[inline(always)]\n" <>
  "    fn into_value(self) -> Value { mk_int(self) }\n" <>
  "}\n" <>
  "impl Repr for f64 {\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_value(value: &Value) -> f64 { value.unwrap_number() }\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_int(value: i64) -> f64 { value as f64 }\n" <>
  "    #[inline(always)]\n" <>
  "    fn into_value(self) -> Value { mk_number(self) }\n" <>
  "}\n" <>
  "impl Repr for bool {\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_value(value: &Value) -> bool { value.unwrap_bool() }\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_int(value: i64) -> bool { value != 0 }\n" <>
  "    #[inline(always)]\n" <>
  "    fn into_value(self) -> Value { mk_bool(self) }\n" <>
  "}\n" <>
  "impl Repr for char {\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_value(value: &Value) -> char { value.unwrap_char() }\n" <>
  "    #[inline(always)]\n" <>
  "    fn from_int(value: i64) -> char { std::char::from_u32(value as u32).unwrap_or('\\0') }\n" <>
  "    #[inline(always)]\n" <>
  "    fn into_value(self) -> Value { mk_char(self) }\n" <>
  "}\n\n" <>
  "pub enum IntItems {\n" <>
  "    Boxed(std::rc::Rc<Vec<UnknownType>>),\n" <>
  "    Ints(std::rc::Rc<Vec<i64>>),\n" <>
  "}\n" <>
  "impl IntItems {\n" <>
  "    pub fn from(xs: &Value) -> IntItems {\n" <>
  "        match xs.resolve() {\n" <>
  "            Value::Array(v) => IntItems::Boxed(v.clone()),\n" <>
  "            Value::IntArray(v) => IntItems::Ints(v.clone()),\n" <>
  "            _ => panic!(\"Expected Array\"),\n" <>
  "        }\n" <>
  "    }\n" <>
  "    pub fn len(&self) -> usize {\n" <>
  "        match self { IntItems::Boxed(v) => v.len(), IntItems::Ints(v) => v.len() }\n" <>
  "    }\n" <>
  "    pub fn raw(&self, index: usize) -> UnknownType {\n" <>
  "        match self { IntItems::Boxed(v) => v[index].clone(), IntItems::Ints(v) => Value::Int(v[index]) }\n" <>
  "    }\n" <>
  "    pub fn item<A: Repr>(&self, index: usize) -> A {\n" <>
  "        match self { IntItems::Boxed(v) => A::from_value(&v[index]), IntItems::Ints(v) => A::from_int(v[index]) }\n" <>
  "    }\n" <>
  "    pub fn int_at(&self, index: usize) -> i64 {\n" <>
  "        match self { IntItems::Boxed(v) => v[index].unwrap_int(), IntItems::Ints(v) => v[index] }\n" <>
  "    }\n" <>
  "}\n\n"

typedTraversalsSource :: String
typedTraversalsSource = "\n\npub mod typed {\n" <>
  "    use crate::*;\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldl<A: Repr, B: Repr, F: FnMut(B, A) -> B>(xs: Value, init: B, mut f: F) -> B {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut acc = init;\n" <>
  "        for i in 0..items.len() { acc = f(acc, items.item::<A>(i)); }\n" <>
  "        acc\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldr<A: Repr, B: Repr, F: FnMut(A, B) -> B>(xs: Value, init: B, mut f: F) -> B {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut acc = init;\n" <>
  "        for i in (0..items.len()).rev() { acc = f(items.item::<A>(i), acc); }\n" <>
  "        acc\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn filter<A: Repr, P: FnMut(A) -> bool>(xs: Value, mut p: P) -> Value {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut result = Vec::with_capacity(items.len());\n" <>
  "        for i in 0..items.len() {\n" <>
  "            let value = items.item::<A>(i);\n" <>
  "            if p(value.clone()) { result.push(items.raw(i)); }\n" <>
  "        }\n" <>
  "        mk_array(result)\n" <>
  "    }\n" <>
  -- Fused pipelines: a range producer can stay virtual, so the traversals
  -- below never materialize the intermediate arrays at all.
  "    #[inline(always)]\n" <>
  "    pub fn length_range(start: i64, end: i64) -> i64 {\n" <>
  "        if start <= end { end.wrapping_sub(start).wrapping_add(1) } else { start.wrapping_sub(end).wrapping_add(1) }\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  -- A canonical `while i < end` loop with a trailing element keeps the
  -- induction variable countable (so LLVM vectorizes it) and never steps the
  -- counter past its bound.
  "    pub fn filter_range<A: Repr, P: FnMut(A) -> bool>(start: i64, end: i64, mut p: P) -> Value {\n" <>
  "        let mut result: Vec<UnknownType> = Vec::new();\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { if p(A::from_int(i)) { result.push(Value::Int(i)); } i += 1; }\n" <>
  "            if p(A::from_int(end)) { result.push(Value::Int(end)); }\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { if p(A::from_int(i)) { result.push(Value::Int(i)); } i -= 1; }\n" <>
  "            if p(A::from_int(end)) { result.push(Value::Int(end)); }\n" <>
  "        }\n" <>
  "        mk_array(result)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldl_range<A: Repr, B: Repr, F: FnMut(B, A) -> B>(start: i64, end: i64, init: B, mut f: F) -> B {\n" <>
  "        let mut acc = init;\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { acc = f(acc, A::from_int(i)); i += 1; }\n" <>
  "            f(acc, A::from_int(end))\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { acc = f(acc, A::from_int(i)); i -= 1; }\n" <>
  "            f(acc, A::from_int(end))\n" <>
  "        }\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldl_filter<A: Repr, B: Repr, P: FnMut(A) -> bool, F: FnMut(B, A) -> B>(xs: Value, init: B, mut p: P, mut f: F) -> B {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut acc = init;\n" <>
  "        for i in 0..items.len() {\n" <>
  "            let value = items.item::<A>(i);\n" <>
  "            if p(value.clone()) { acc = f(acc, value); }\n" <>
  "        }\n" <>
  "        acc\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldl_filter_range<A: Repr, B: Repr, P: FnMut(A) -> bool, F: FnMut(B, A) -> B>(start: i64, end: i64, init: B, mut p: P, mut f: F) -> B {\n" <>
  "        let mut acc = init;\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { let value = A::from_int(i); if p(value.clone()) { acc = f(acc, value); } i += 1; }\n" <>
  "            let value = A::from_int(end); if p(value.clone()) { acc = f(acc, value); }\n" <>
  "            acc\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { let value = A::from_int(i); if p(value.clone()) { acc = f(acc, value); } i -= 1; }\n" <>
  "            let value = A::from_int(end); if p(value.clone()) { acc = f(acc, value); }\n" <>
  "            acc\n" <>
  "        }\n" <>
  "    }\n" <>
  -- Integer addition and multiplication are associative and commutative, so a
  -- known integer reduction can keep four independent accumulators. The body
  -- unrolls into vector work instead of a single dependency chain.
  "    #[inline(always)]\n" <>
  "    pub fn sum_range(start: i64, end: i64, init: i64) -> i64 {\n" <>
  "        let mut a0 = init; let mut a1 = 0i64; let mut a2 = 0i64; let mut a3 = 0i64;\n" <>
  "        let mut i = start;\n" <>
  "        if start <= end {\n" <>
  "            while i + 3 <= end { a0 += i; a1 += i + 1; a2 += i + 2; a3 += i + 3; i += 4; }\n" <>
  "            while i <= end { a0 += i; i += 1; }\n" <>
  "        } else {\n" <>
  "            while i - 3 >= end { a0 += i; a1 += i - 1; a2 += i - 2; a3 += i - 3; i -= 4; }\n" <>
  "            while i >= end { a0 += i; i -= 1; }\n" <>
  "        }\n" <>
  "        (a0 + a1) + (a2 + a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn sum_filter_range<P: FnMut(i64) -> bool>(start: i64, end: i64, init: i64, mut p: P) -> i64 {\n" <>
  "        let mut a0 = init; let mut a1 = 0i64; let mut a2 = 0i64; let mut a3 = 0i64;\n" <>
  "        let mut i = start;\n" <>
  "        if start <= end {\n" <>
  "            while i + 3 <= end {\n" <>
  "                if p(i) { a0 += i; } if p(i + 1) { a1 += i + 1; }\n" <>
  "                if p(i + 2) { a2 += i + 2; } if p(i + 3) { a3 += i + 3; }\n" <>
  "                i += 4;\n" <>
  "            }\n" <>
  "            while i <= end { if p(i) { a0 += i; } i += 1; }\n" <>
  "        } else {\n" <>
  "            while i - 3 >= end {\n" <>
  "                if p(i) { a0 += i; } if p(i - 1) { a1 += i - 1; }\n" <>
  "                if p(i - 2) { a2 += i - 2; } if p(i - 3) { a3 += i - 3; }\n" <>
  "                i -= 4;\n" <>
  "            }\n" <>
  "            while i >= end { if p(i) { a0 += i; } i -= 1; }\n" <>
  "        }\n" <>
  "        (a0 + a1) + (a2 + a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn product_range(start: i64, end: i64, init: i64) -> i64 {\n" <>
  "        let mut a0 = init; let mut a1 = 1i64; let mut a2 = 1i64; let mut a3 = 1i64;\n" <>
  "        let mut i = start;\n" <>
  "        if start <= end {\n" <>
  "            while i + 3 <= end { a0 *= i; a1 *= i + 1; a2 *= i + 2; a3 *= i + 3; i += 4; }\n" <>
  "            while i <= end { a0 *= i; i += 1; }\n" <>
  "        } else {\n" <>
  "            while i - 3 >= end { a0 *= i; a1 *= i - 1; a2 *= i - 2; a3 *= i - 3; i -= 4; }\n" <>
  "            while i >= end { a0 *= i; i -= 1; }\n" <>
  "        }\n" <>
  "        (a0 * a1) * (a2 * a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn product_filter_range<P: FnMut(i64) -> bool>(start: i64, end: i64, init: i64, mut p: P) -> i64 {\n" <>
  "        let mut a0 = init; let mut a1 = 1i64; let mut a2 = 1i64; let mut a3 = 1i64;\n" <>
  "        let mut i = start;\n" <>
  "        if start <= end {\n" <>
  "            while i + 3 <= end {\n" <>
  "                if p(i) { a0 *= i; } if p(i + 1) { a1 *= i + 1; }\n" <>
  "                if p(i + 2) { a2 *= i + 2; } if p(i + 3) { a3 *= i + 3; }\n" <>
  "                i += 4;\n" <>
  "            }\n" <>
  "            while i <= end { if p(i) { a0 *= i; } i += 1; }\n" <>
  "        } else {\n" <>
  "            while i - 3 >= end {\n" <>
  "                if p(i) { a0 *= i; } if p(i - 1) { a1 *= i - 1; }\n" <>
  "                if p(i - 2) { a2 *= i - 2; } if p(i - 3) { a3 *= i - 3; }\n" <>
  "                i -= 4;\n" <>
  "            }\n" <>
  "            while i >= end { if p(i) { a0 *= i; } i -= 1; }\n" <>
  "        }\n" <>
  "        (a0 * a1) * (a2 * a3)\n" <>
  "    }\n" <>
  -- Counting a predicate never materializes the filtered array.
  "    #[inline(always)]\n" <>
  "    pub fn count_filter_array<A: Repr, P: FnMut(A) -> bool>(xs: Value, mut p: P) -> i64 {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut count = 0i64;\n" <>
  "        for i in 0..items.len() { if p(items.item::<A>(i)) { count += 1; } }\n" <>
  "        count\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn count_filter_range<A: Repr, P: FnMut(A) -> bool>(start: i64, end: i64, mut p: P) -> i64 {\n" <>
  "        let mut count = 0i64;\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { if p(A::from_int(i)) { count += 1; } i += 1; }\n" <>
  "            if p(A::from_int(end)) { count += 1; }\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { if p(A::from_int(i)) { count += 1; } i -= 1; }\n" <>
  "            if p(A::from_int(end)) { count += 1; }\n" <>
  "        }\n" <>
  "        count\n" <>
  "    }\n" <>
  -- Associative reductions over a boxed array. Integer elements are unboxed
  -- once and kept in independent accumulators.
  "    #[inline(always)]\n" <>
  "    pub fn sum_array(xs: Value, init: i64) -> i64 {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut a0 = init; let mut a1 = 0i64; let mut a2 = 0i64; let mut a3 = 0i64;\n" <>
  "        let mut i = 0usize;\n" <>
  "        while i + 4 <= items.len() {\n" <>
  "            a0 += items.int_at(i); a1 += items.int_at(i + 1);\n" <>
  "            a2 += items.int_at(i + 2); a3 += items.int_at(i + 3);\n" <>
  "            i += 4;\n" <>
  "        }\n" <>
  "        while i < items.len() { a0 += items.int_at(i); i += 1; }\n" <>
  "        (a0 + a1) + (a2 + a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn product_array(xs: Value, init: i64) -> i64 {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut a0 = init; let mut a1 = 1i64; let mut a2 = 1i64; let mut a3 = 1i64;\n" <>
  "        let mut i = 0usize;\n" <>
  "        while i + 4 <= items.len() {\n" <>
  "            a0 *= items.int_at(i); a1 *= items.int_at(i + 1);\n" <>
  "            a2 *= items.int_at(i + 2); a3 *= items.int_at(i + 3);\n" <>
  "            i += 4;\n" <>
  "        }\n" <>
  "        while i < items.len() { a0 *= items.int_at(i); i += 1; }\n" <>
  "        (a0 * a1) * (a2 * a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn sum_filter_array<P: FnMut(i64) -> bool>(xs: Value, init: i64, mut p: P) -> i64 {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut a0 = init; let mut a1 = 0i64; let mut a2 = 0i64; let mut a3 = 0i64;\n" <>
  "        let mut i = 0usize;\n" <>
  "        while i + 4 <= items.len() {\n" <>
  "            let v0 = items.int_at(i); if p(v0) { a0 += v0; }\n" <>
  "            let v1 = items.int_at(i + 1); if p(v1) { a1 += v1; }\n" <>
  "            let v2 = items.int_at(i + 2); if p(v2) { a2 += v2; }\n" <>
  "            let v3 = items.int_at(i + 3); if p(v3) { a3 += v3; }\n" <>
  "            i += 4;\n" <>
  "        }\n" <>
  "        while i < items.len() { let v = items.int_at(i); if p(v) { a0 += v; } i += 1; }\n" <>
  "        (a0 + a1) + (a2 + a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn product_filter_array<P: FnMut(i64) -> bool>(xs: Value, init: i64, mut p: P) -> i64 {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        let mut a0 = init; let mut a1 = 1i64; let mut a2 = 1i64; let mut a3 = 1i64;\n" <>
  "        let mut i = 0usize;\n" <>
  "        while i + 4 <= items.len() {\n" <>
  "            let v0 = items.int_at(i); if p(v0) { a0 *= v0; }\n" <>
  "            let v1 = items.int_at(i + 1); if p(v1) { a1 *= v1; }\n" <>
  "            let v2 = items.int_at(i + 2); if p(v2) { a2 *= v2; }\n" <>
  "            let v3 = items.int_at(i + 3); if p(v3) { a3 *= v3; }\n" <>
  "            i += 4;\n" <>
  "        }\n" <>
  "        while i < items.len() { let v = items.int_at(i); if p(v) { a0 *= v; } i += 1; }\n" <>
  "        (a0 * a1) * (a2 * a3)\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn any_array<A: Repr, P: FnMut(A) -> bool>(xs: Value, mut p: P) -> bool {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        for i in 0..items.len() { if p(items.item::<A>(i)) { return true; } }\n" <>
  "        false\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn all_array<A: Repr, P: FnMut(A) -> bool>(xs: Value, mut p: P) -> bool {\n" <>
  "        let items = IntItems::from(&xs);\n" <>
  "        for i in 0..items.len() { if !p(items.item::<A>(i)) { return false; } }\n" <>
  "        true\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn any_range<A: Repr, P: FnMut(A) -> bool>(start: i64, end: i64, mut p: P) -> bool {\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { if p(A::from_int(i)) { return true; } i += 1; }\n" <>
  "            p(A::from_int(end))\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { if p(A::from_int(i)) { return true; } i -= 1; }\n" <>
  "            p(A::from_int(end))\n" <>
  "        }\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn all_range<A: Repr, P: FnMut(A) -> bool>(start: i64, end: i64, mut p: P) -> bool {\n" <>
  "        if start <= end {\n" <>
  "            let mut i = start;\n" <>
  "            while i < end { if !p(A::from_int(i)) { return false; } i += 1; }\n" <>
  "            p(A::from_int(end))\n" <>
  "        } else {\n" <>
  "            let mut i = start;\n" <>
  "            while i > end { if !p(A::from_int(i)) { return false; } i -= 1; }\n" <>
  "            p(A::from_int(end))\n" <>
  "        }\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn foldl_replicate<A: Repr, B: Repr, F: FnMut(B, A) -> B>(count: i64, value: Value, init: B, mut f: F) -> B {\n" <>
  "        let item = A::from_value(&value);\n" <>
  "        let mut acc = init;\n" <>
  "        let mut i = 0i64;\n" <>
  "        while i < count { acc = f(acc, item.clone()); i += 1; }\n" <>
  "        acc\n" <>
  "    }\n" <>
  "    #[inline(always)]\n" <>
  "    pub fn filter_replicate<A: Repr, P: FnMut(A) -> bool>(count: i64, value: Value, mut p: P) -> Value {\n" <>
  "        if count > 0 && p(A::from_value(&value)) { mk_array(vec![value; count as usize]) } else { mk_array(Vec::new()) }\n" <>
  "    }\n" <>
  "}\n"

chunkArray :: forall a. Int -> Array a -> Array (Array a)
chunkArray size arr =
  if Array.length arr <= 0 then []
  else [Array.take size arr] <> chunkArray size (Array.drop size arr)

globalConsumed :: Ref.Ref (Set.Set String)
globalConsumed = unsafePerformEffect (Ref.new Set.empty)

globalCaptured :: Ref.Ref (Set.Set String)
globalCaptured = unsafePerformEffect (Ref.new Set.empty)

-- Generated builder metadata is separate from ordinary signatures, so a
-- foreign function with a similar spelling can never become a cell helper.
type ReuseContext =
  { workers :: Set String
  , privateWorkers :: Set String
  , functionIterators :: Set String
  , childCases :: Map String (Array ChildCalls.ConstructorCase)
  , postChildCases :: Map String { branch :: ChildCalls.ConstructorCase, name :: String, permutation :: Maybe String }
  , closedCalls :: Set String
  , plainTrees :: Set String
  , constructors :: Map String
      { name :: Qualified Ident, resultType :: ExprType, typeName :: String }
  }

-- Callers without declaration metadata retain the Rc layout. The CLI supplies
-- a global enum context to codegenModuleWithValueEnums for every module.
codegenModule :: Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Module Ann -> BackendModule -> String
codegenModule = codegenModuleWithValueEnums Set.empty

codegenModuleWithValueEnums :: ValueEnums -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Module Ann -> BackendModule -> String
codegenModuleWithValueEnums = codegenModuleWithOptions { threaded: false, moduleValues: Set.empty, fieldRenames: Map.empty }

-- Source usage facts stop at the CoreFn boundary. Rust clone/move decisions
-- use liveness from the transformed backend tree and runtime Rc uniqueness.
-- Callers with original TAST declarations opt into bounded module sharing.
-- The ownership mode is explicit, independent of the Rc/Arc text transform.
codegenModuleWithOptions :: { threaded :: Boolean, moduleValues :: Set Ident, fieldRenames :: Map.Map String String } -> ValueEnums -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Module Ann -> BackendModule -> String
codegenModuleWithOptions options valueEnums globalAritiesMap globalClassFields (Module coreFnMod) backendMod =
  let
    modNameStr = String.replaceAll (Pattern ".") (Replacement "_") (unwrap backendMod.name)
    renames = options.fieldRenames
    
    -- Traduction des Enums (ADTs)
    enumsCode = String.joinWith "\n" $ map (\decl ->
      let 
        enumName = sanitizeIdent decl.name
        ctors = map (\ctor ->
          let ctorNameClean = sanitizeIdent ctor.name
              fields = map (\fieldTy -> codegenExprTypeWithValueEnums valueEnums modNameStr false fieldTy) ctor.fields
          in "    " <> ctorNameClean <> if Array.length fields > 0 then "(" <> String.joinWith ", " fields <> ")" else ""
        ) decl.constructors
        takeBody = case Array.find (Array.null <<< _.fields) decl.constructors of
          Just ctor -> "std::option::Option::Some(std::mem::replace(self, Self::" <> sanitizeIdent ctor.name <> "))"
          Nothing -> "std::option::Option::None"
        -- A real nullary constructor is a valid temporary payload. Types with
        -- no such constructor retain the existing reconstruction path.
        takeMethod = if isValueEnum valueEnums modNameStr decl.name then "" else
          "impl " <> enumName <> " { pub fn __purust_take(&mut self) -> std::option::Option<Self> { " <> takeBody <> " } }\n"
      in
        (if isValueEnum valueEnums modNameStr decl.name then "#[derive(Clone, Copy)]" else "#[derive(Clone)]") <>
        "\npub enum " <> enumName <> " {\n" <> String.joinWith ",\n" ctors <> "\n}\n" <> takeMethod
    ) coreFnMod.dataDecls

    -- Traduction des Classes (Type Classes)
    classesCode = String.joinWith "\n" $ map (\(classDecl :: ClassDecl) ->
      let 
        className = sanitizeIdent classDecl.name
        
        superFields = map (\(Tuple scName scType) ->
          "    pub " <> recordFieldIdent renames scName <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr false scType
        ) (superclassFields classDecl)
        
        methFields = map (\(Tuple mName mTy) ->
          "    pub " <> recordFieldIdent renames mName <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr false mTy
        ) classDecl.methods
        
        fieldsCode = String.joinWith ",\n" (Array.concat [superFields, methFields])
      in
        "#[derive(Clone)]\npub struct " <> className <> " {\n" <> fieldsCode <> "\n}\n"
    ) coreFnMod.classDecls

    -- Internal workers receive a consumed cell as their final argument. Their
    -- public counterparts retain the original ABI and allocation behaviour.
    reservedGlobals = Set.fromFoldable (Array.mapMaybe (map sanitizeIdent <<< String.stripPrefix (Pattern (modNameStr <> "_"))) (Array.fromFoldable (Map.keys globalAritiesMap)))
    scalarized = optimizeRecordLoops sanitizeIdent reservedGlobals backendMod.name backendMod.bindings
    fused = optimizeThunkProducers sanitizeIdent reservedGlobals backendMod.name scalarized.bindings
    namedGroups = map (\group -> group { bindings = map (\(Tuple ident expr) -> Tuple ident (renameLocals expr)) group.bindings }) fused.bindings
    -- The global signature map also contains local foreign declarations,
    -- which have no binding body here but still reserve their Rust names.
    bindingNames = Set.union
      (Set.fromFoldable (Array.concatMap (map (\(Tuple (Ident name) _) -> sanitizeIdent name) <<< _.bindings) namedGroups))
      reservedGlobals
    reusableDecls = Array.filter (\decl -> not (isValueEnum valueEnums modNameStr decl.name)
      && representation (ADT decl.name [unwrap backendMod.name, decl.name] []) == "std::rc::Rc<crate::" <> sanitizeIdent decl.name <> ">"
      && Array.any (Array.null <<< _.fields) decl.constructors
      && Array.all (\ctor -> not (Set.member ("__purust_rebuild_" <> sanitizeIdent ctor.name) bindingNames)) decl.constructors) coreFnMod.dataDecls
    rebuilders = Map.fromFoldable $ Array.concatMap (\decl -> map (\ctor ->
      Tuple ctor.name
        { name: "__purust_rebuild_" <> sanitizeIdent ctor.name
        , ctorName: ctor.name
        , typeName: decl.name
        , resultType: ADT decl.name [unwrap backendMod.name, decl.name] []
        , fields: ctor.fields
        }) decl.constructors) reusableDecls
    constructorHelper (Qualified mbMod (Ident ctor)) (ProperName tyName) = do
      helper <- Map.lookup ctor rebuilders
      if helper.typeName == tyName && (mbMod == Nothing || mbMod == Just backendMod.name)
        then Just { name: Qualified Nothing (Ident helper.name), resultType: helper.resultType }
        else Nothing
    representation = codegenExprTypeWithValueEnums valueEnums modNameStr false
    prepareWorker group (Tuple (Ident name) expr) = do
      let ty = inferTypeExpr modNameStr globalAritiesMap globalClassFields Map.empty expr
          args = extractAllArgTypes ty
          ret = extractFinalRetType ty
          workerName = sanitizeIdent name <> "__purust_reuse"
      if group.recursive || Array.null args || Set.member workerName bindingNames then Nothing else do
        Tuple params body <- extractAbsParams (Array.length args) expr
        rewritten <- rewriteReturns representation constructorHelper ret "__purust_cell" body
        paramsNE <- NonEmptyArray.fromArray params
        let workerTy = Func (Array.snoc args ret) ret
            workerParams = NonEmptyArray.snoc (NonEmptyArray.mapWithIndex (\i param -> Tuple (Just (Ident param)) (Level i)) paramsNE) (Tuple (Just (Ident "__purust_cell")) (Level (-1)))
        pure { original: modNameStr <> "_" <> sanitizeIdent name, name: workerName, ty: workerTy
             , expr: NeutralExpr (Typed workerTy (NeutralExpr (Abs workerParams rewritten))) }
    workers = Array.concatMap (\group -> Array.mapMaybe (prepareWorker group) group.bindings) namedGroups
    workerOriginals = Set.fromFoldable (map _.original workers)
    -- These layouts contain only this tree and native Copy fields. Destruction
    -- cannot invoke an opaque payload destructor or closure while borrowed.
    plainTrees = Set.fromFoldable (Array.mapMaybe (\decl ->
      let native = "std::rc::Rc<crate::" <> sanitizeIdent decl.name <> ">"
      in if Array.all (\ctor -> Array.all (\ty -> representation ty == native
          || copyScalarType valueEnums modNameStr ty) ctor.fields) decl.constructors
        then Just native else Nothing) reusableDecls)
    copyTagType ty = case unwrapType ty of
      ADT _ _ _ -> copyScalarType valueEnums modNameStr ty
      _ -> false
    closedCalls = Set.map (\name -> modNameStr <> "_" <> sanitizeIdent name)
      (ChildCalls.closedFunctions backendMod.name namedGroups)
    nativeConstructors = Map.fromFoldable (Array.concatMap (\decl ->
      let resultType = ADT decl.name [unwrap backendMod.name, decl.name] []
          native = "crate::" <> sanitizeIdent decl.name
          repr = representation resultType
      in if repr == "std::rc::Rc<" <> native <> ">" || (repr == native && copyTagType resultType)
        then map (\ctor -> Tuple ctor.name { resultType, fields: ctor.fields }) decl.constructors
        else []) coreFnMod.dataDecls)
    constructorInfo (Qualified mbMod (Ident name)) =
      if mbMod == Nothing || mbMod == Just backendMod.name then Map.lookup name nativeConstructors else Nothing
    reservedPredicateNames = Set.unions
      [ bindingNames
      , Set.fromFoldable (map _.name (Map.values rebuilders))
      , Set.fromFoldable (map _.name workers)
      ]
    prepareChildCases (Tuple (Ident name) expr) = do
      let ty = inferTypeExpr modNameStr globalAritiesMap globalClassFields Map.empty expr
          args = extractAllArgTypes ty
      Tuple params body <- extractAbsParams (Array.length args) expr
      let cases = ChildCalls.constructorCases representation copyTagType
            params args (extractFinalRetType ty) body
      if Array.null cases then Nothing else Just (Tuple (modNameStr <> "_" <> sanitizeIdent name) cases)
    preparePostChildCase (Tuple (Ident name) expr) = do
      let fullName = modNameStr <> "_" <> sanitizeIdent name
          predicateName = sanitizeIdent name <> "__purust_child_rebuilds"
          ty = inferTypeExpr modNameStr globalAritiesMap globalClassFields Map.empty expr
          args = extractAllArgTypes ty
      guard (Set.member fullName closedCalls && Set.member fullName workerOriginals
        && Set.member (representation (extractFinalRetType ty)) plainTrees
        && not (Set.member predicateName reservedPredicateNames))
      Tuple params body <- extractAbsParams (Array.length args) expr
      result <- ChildBranches.constructorPredicate representation copyTagType constructorInfo
        params args (extractFinalRetType ty) body
      guard (result.predicate /= ChildBranches.Constant false)
      let generatedName = modNameStr <> "_" <> predicateName
          branch = { guards: [], constructor: result.constructor, typeName: result.typeName, fieldParams: result.fieldParams }
      code <- predicateFunction representation sanitizeIdent constructorInfo args generatedName result.predicate
      let permutation = do
            let helperName = sanitizeIdent name <> "__purust_permute_fields"
                fullHelperName = modNameStr <> "_" <> helperName
            guard (not (Set.member helperName reservedPredicateNames)
              && not (Set.member (helperName <> "__matches") reservedPredicateNames))
            plan <- fieldPermutation representation (copyScalarType valueEnums modNameStr)
              copyTagType constructorInfo params args (extractFinalRetType ty) body
            guard (plan.constructor == result.constructor && plan.typeName == result.typeName
              && plan.fieldParams == result.fieldParams)
            helperCode <- permutationFunction representation sanitizeIdent constructorInfo args fullHelperName plan
            pure { name: fullHelperName, code: helperCode }
      pure { fullName, branch, name: generatedName, permutation: map _.name permutation
           , code: code <> foldMap _.code permutation }
    postHelpers = Array.concatMap (Array.mapMaybe preparePostChildCase <<< _.bindings) namedGroups
    reuseContext =
      { workers: workerOriginals
      , childCases: Map.fromFoldable (Array.concatMap (Array.mapMaybe prepareChildCases <<< _.bindings) namedGroups)
      , postChildCases: Map.fromFoldable (map (\helper -> Tuple helper.fullName
          { branch: helper.branch, name: helper.name, permutation: helper.permutation }) postHelpers)
      , closedCalls
      , plainTrees
      , functionIterators: Set.map (\(Ident name) -> modNameStr <> "_" <> sanitizeIdent name)
          (countedFunctionProducers backendMod.name namedGroups)
      , privateWorkers: Set.union
          (Set.fromFoldable (map (\worker -> modNameStr <> "_" <> worker.name) workers))
          (Set.map (\(Ident name) -> modNameStr <> "_" <> sanitizeIdent name) (Set.union fused.workers scalarized.workers))
      , constructors: Map.fromFoldable (map (\helper -> Tuple (modNameStr <> "_" <> helper.ctorName)
          { name: Qualified Nothing (Ident helper.name), resultType: helper.resultType, typeName: helper.typeName }) (Map.values rebuilders))
      }
    workerGroups = map (\worker -> { recursive: false, bindings: [Tuple (Ident worker.name) worker.expr] }) workers
    helperArities = Map.fromFoldable $ map (\helper -> Tuple (modNameStr <> "_" <> helper.name)
      (Func (Array.snoc helper.fields helper.resultType) helper.resultType)) (Array.fromFoldable (Map.values rebuilders))
    workerArities = Map.fromFoldable (map (\worker -> Tuple (modNameStr <> "_" <> worker.name) worker.ty) workers)
    rebuildersCode = foldMap (\helper ->
      let ret = representation helper.resultType
          params = Array.mapWithIndex (\i ty -> "a" <> show i <> ": " <> representation ty) helper.fields
          values = String.joinWith ", " (Array.mapWithIndex (\i _ -> "a" <> show i) helper.fields)
          payload = "crate::" <> sanitizeIdent helper.typeName <> "::" <> sanitizeIdent helper.ctorName <> (if Array.null helper.fields then "" else "(" <> values <> ")")
      in "fn " <> modNameStr <> "_" <> helper.name <> "(" <> String.joinWith ", " (Array.snoc params ("mut __purust_cell: " <> ret)) <> ") -> " <> ret <> " {\n" <>
         "let payload = " <> payload <> ";\n" <>
         "if let std::option::Option::Some(slot) = std::rc::Rc::get_mut(&mut __purust_cell) { *slot = payload; __purust_cell } else { std::rc::Rc::new(payload) }\n}\n") (Map.values rebuilders)
    bindingsRes = Array.foldl (\acc group ->
      let res = codegenBindingGroup options valueEnums coreFnMod.name modNameStr Set.empty reuseContext acc.arities globalClassFields group
      in { code: acc.code <> res.code, arities: res.arities }
    ) { code: rebuildersCode <> foldMap _.code postHelpers, arities: Map.union workerArities (Map.union helperArities globalAritiesMap) } (namedGroups <> workerGroups)

    bindingsCode = bindingsRes.code
    
  in
    "// Code generated by purust for module " <> modNameStr <> "\n\n" <>
    enumsCode <> "\n" <>
    classesCode <> "\n" <>
    bindingsCode

-- The generic carrier owns Record_a; keep a closed { a :: ... } disjoint.
-- Ordinary closed records always use Record_, so ClosedRecord_a cannot clash.
recordStructName :: Map.Map String String -> Array String -> String
recordStructName renames fields = case String.joinWith "_" (map (fieldBase renames) (Array.nub (Array.sortBy compare fields))) of
  "" -> "Record_a"
  "a" -> "ClosedRecord_a"
  shape -> "Record_" <> shape

codegenPrelude :: Set.Set String -> String
codegenPrelude fields = codegenPreludeWithRenames (fieldRenames (shapeLabels fields)) (Array.fromFoldable fields)

-- The CLI shares one compilation-wide map so the prelude, every module and the
-- class dictionaries agree on each label spelling. Shapes are ordered so the
-- native carrier enumerates its fields in the order the source wrote them;
-- `chooseRecordShapes` in Main keeps one ordered representative per label set.
codegenPreludeWithRenames :: Map.Map String String -> Array String -> String
codegenPreludeWithRenames renames shapes =
  let
    
    uniqueFields = Array.fromFoldable (Set.fromFoldable (Array.concatMap (\shape -> String.split (Pattern ",") shape) shapes))
    validUniqueFields = Array.filter (not <<< String.null) uniqueFields
    -- Legacy constructor metadata is not user record data. Reserved labels
    -- live in closed shapes or DynamicRecord when an open record is extended.
    genericFields = Array.filter (\f -> not (Array.elem f ["tag", "vals", "call"])) validUniqueFields
    genericFieldArm f body = if Array.elem f genericFields then body else ""
    
    validShapes = Array.filter (\shape -> not (String.null shape)) shapes

    shapeToStructName = recordStructName renames <<< String.split (Pattern ",")
    
    recordStructs = Array.foldMap (\shape -> 
      let structName = shapeToStructName shape
          structFields = Array.filter (\f -> not (String.null f)) (String.split (Pattern ",") shape)
      in "#[derive(Clone, Default)]\npub struct " <> structName <> " {\n" <>
         Array.foldMap (\f -> "    pub " <> recordFieldIdent renames f <> ": Option<UnknownType>,\n") structFields <>
         "}\n\n"
    ) validShapes

    recordVariants = Array.foldMap (\shape -> 
      let structName = shapeToStructName shape
      in "    " <> structName <> "(perceus_ptr::PerceusPtr<" <> structName <> ">),\n"
    ) validShapes
    
    getMethods = Array.foldMap (\f -> 
      let sf = fieldBase renames f
          field = recordFieldIdent renames f
          matchArms = Array.foldMap (\shape -> 
             let structName = shapeToStructName shape
             in if Array.elem f (String.split (Pattern ",") shape) then
                  "            Value::" <> structName <> "(r) => r." <> field <> ".clone().unwrap(),\n"
                else ""
          ) validShapes
      in "    pub fn get_" <> sf <> "(&self) -> UnknownType {\n" <>
         "        match self.resolve() {\n" <> matchArms <>
         genericFieldArm f ("            Value::Record_a(r) => r." <> field <> ".clone().unwrap(),\n") <>
         "            Value::DynamicRecord(r) => r.get(" <> show f <> ").cloned().expect(\"Missing record field\"),\n" <>
         "            _ => panic!(\"Expected record with field " <> sf <> "\"),\n" <>
         "        }\n" <>
         "    }\n"
    ) validUniqueFields

    dynamicGetMethod =
      "    pub fn __purust_get_field(&self, name: &str) -> Option<Value> {\n" <>
      "        match self.resolve() {\n" <>
      Array.foldMap (\shape ->
        "            Value::" <> shapeToStructName shape <> "(r) => match name {\n" <>
        Array.foldMap (\f -> "                " <> show f <> " => r." <> recordFieldIdent renames f <> ".clone(),\n")
          (String.split (Pattern ",") shape) <>
        "                _ => None,\n            },\n") validShapes <>
      "            Value::Record_a(r) => match name {\n" <>
      Array.foldMap (\f -> "                " <> show f <> " => r." <> recordFieldIdent renames f <> ".clone(),\n") genericFields <>
      "                _ => None,\n            },\n" <>
      "            Value::DynamicRecord(r) => r.get(name).cloned(),\n" <>
      "            _ => panic!(\"Expected record\"),\n" <>
      "        }\n    }\n"

    -- Foreign insertion can extend a closed shape or use a runtime-only key.
    -- Keep existing native shapes for replacements; only widen when necessary.
    -- All updates use COW and retain the other values without evaluating them.
    setKnownFields names = "match name {\n" <>
      Array.foldMap (\f -> "                " <> show f <> " => { perceus_ptr::PerceusPtr::make_mut(r)." <>
        recordFieldIdent renames f <> " = Some(value); return self; },\n") names <>
      "                _ => {},\n            }"
    copyFields names = Array.foldMap (\f ->
      "                if let Some(value) = &r." <> recordFieldIdent renames f <>
      " { fields.insert(" <> show f <> ".to_owned(), value.clone()); }\n") names
    dynamicSetMethod =
      "    pub fn __purust_set_field(mut self, name: &str, value: Value) -> Value {\n" <>
      "        if matches!(self, Value::Thunk(_)) { self = self.resolve().clone(); }\n" <>
      "        match &mut self {\n" <>
      Array.foldMap (\shape -> "            Value::" <> shapeToStructName shape <>
        "(r) => " <> setKnownFields (String.split (Pattern ",") shape) <> ",\n") validShapes <>
      "            Value::Record_a(r) => " <> setKnownFields genericFields <> ",\n" <>
      "            Value::DynamicRecord(r) => { perceus_ptr::PerceusPtr::make_mut(r).insert(name.to_owned(), value); return self; },\n" <>
      "            _ => panic!(\"Expected record\"),\n        }\n" <>
      "        let mut fields = RecordFields::new();\n" <>
      "        match &self {\n" <>
      Array.foldMap (\shape -> "            Value::" <> shapeToStructName shape <>
        "(r) => {\n" <> copyFields (String.split (Pattern ",") shape) <> "            },\n") validShapes <>
      "            Value::Record_a(r) => {\n" <> copyFields genericFields <> "            },\n" <>
      "            _ => unreachable!(),\n        }\n" <>
      "        fields.insert(name.to_owned(), value);\n" <>
      "        Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields))\n    }\n"

    recordEntriesMethod =
      "    pub fn __purust_record_fields(&self) -> Option<RecordFields> {\n" <>
      "        let mut fields = RecordFields::new();\n        match self.resolve() {\n" <>
      Array.foldMap (\shape -> "            Value::" <> shapeToStructName shape <>
        "(r) => {\n" <> copyFields (String.split (Pattern ",") shape) <> "            },\n") validShapes <>
      "            Value::Record_a(r) => {\n" <> copyFields genericFields <> "            },\n" <>
      "            Value::DynamicRecord(r) => return Some((**r).clone()),\n" <>
      "            _ => return None,\n        }\n        Some(fields)\n    }\n"

    -- Keep the ordinary owned getters for escaping values. Scalar consumers
    -- can borrow a whole projection path and copy only its final primitive.
    borrowMethods = Array.foldMap (\f ->
      let sf = fieldBase renames f
          field = recordFieldIdent renames f
          matchArms = Array.foldMap (\shape ->
             let structName = shapeToStructName shape
             in if Array.elem f (String.split (Pattern ",") shape) then
                  "            Value::" <> structName <> "(r) => r." <> field <> ".as_ref().unwrap(),\n"
                else ""
          ) validShapes
      in "    pub fn __purust_borrow_" <> sf <> "(&self) -> &UnknownType {\n" <>
         "        match self.resolve() {\n" <> matchArms <>
         genericFieldArm f ("            Value::Record_a(r) => r." <> field <> ".as_ref().unwrap(),\n") <>
         "            Value::DynamicRecord(r) => r.get(" <> show f <> ").expect(\"Missing record field\"),\n" <>
         "            _ => panic!(\"Expected record with field " <> sf <> "\"),\n" <>
         "        }\n" <>
         "    }\n"
    ) validUniqueFields
    
    setMethods = Array.foldMap (\f -> 
      let sf = fieldBase renames f
          field = recordFieldIdent renames f
          matchArms = Array.foldMap (\shape -> 
             let structName = shapeToStructName shape
             in if Array.elem f (String.split (Pattern ",") shape) then
                  "            Value::" <> structName <> "(r) => {\n" <>
                  "                let mut mut_r = perceus_ptr::PerceusPtr::make_mut(r);\n" <>
                  "                mut_r." <> field <> " = Some(val);\n" <>
                  "            },\n"
                else ""
          ) validShapes
      in "    pub fn set_" <> sf <> "(&mut self, val: UnknownType) {\n" <>
         "        if matches!(self, Value::Thunk(_)) { *self = self.resolve().clone(); }\n" <>
         "        match self {\n" <> matchArms <>
         genericFieldArm f ("            Value::Record_a(r) => {\n" <>
         "                let mut mut_r = perceus_ptr::PerceusPtr::make_mut(r);\n" <>
         "                mut_r." <> field <> " = Some(val);\n" <>
         "            },\n") <>
         "            Value::DynamicRecord(r) => { perceus_ptr::PerceusPtr::make_mut(r).insert(" <> show f <> ".to_owned(), val); },\n" <>
         "            _ => panic!(\"Expected record with field " <> sf <> "\"),\n" <>
         "        }\n" <>
         "    }\n"
    ) validUniqueFields
    
    funcWrappers = Array.foldMap (\arity -> 
      let 
        typeParamsList = map (\i -> "T" <> show i) (Array.range 1 arity)
        typeParams = String.joinWith ", " typeParamsList
        typeParamsWithRet = typeParams <> ", R"
        typeParamsWithBounds = String.joinWith ", " (map (\p -> p <> ": 'static") (typeParamsList <> ["R"]))
        args = String.joinWith ", " typeParamsList
      in
        "#[derive(Clone)]\npub enum Func" <> show arity <> "<" <> typeParamsWithRet <> "> {\n" <>
        "    Static(fn(" <> args <> ") -> R),\n" <>
        "    Shared(std::rc::Rc<dyn Fn(" <> args <> ") -> R>),\n" <>
        "}\n\n" <>
        "impl<" <> typeParamsWithBounds <> "> std::ops::Deref for Func" <> show arity <> "<" <> typeParamsWithRet <> "> {\n" <>
        "    type Target = dyn Fn(" <> args <> ") -> R;\n" <>
        "    #[inline(always)]\n" <>
        "    fn deref(&self) -> &Self::Target {\n" <>
        "        match self {\n" <>
        "            Func" <> show arity <> "::Static(f) => f,\n" <>
        "            Func" <> show arity <> "::Shared(rc) => rc.as_ref(),\n" <>
        "        }\n" <>
        "    }\n" <>
        "}\n\n"
    ) (Array.range 1 maxNativeFunctionArity)
    funcVariants = Array.foldMap (\arity -> 
      let typeParams = String.joinWith ", " (Array.replicate (arity + 1) "UnknownType")
      in "    Func" <> show arity <> "(Func" <> show arity <> "<" <> typeParams <> ">),\n"
    ) (Array.range 1 maxNativeFunctionArity)
    
    funcUnwraps = Array.foldMap (\arity -> 
      let typeParams = String.joinWith ", " (Array.replicate (arity + 1) "UnknownType")
      in "    pub fn unwrap_func" <> show arity <> "(&self) -> Func" <> show arity <> "<" <> typeParams <> "> {\n" <>
         "        let value = self.resolve();\n" <>
         (if arity == 1 then 
           "        if let Value::Func1(v) = value { v.clone() } else if let Value::Record_a(v) = value { v.call.clone().unwrap() } " <>
           String.joinWith " " (map (\a -> "else if let Value::Func" <> show a <> "(v) = value { let f = v.clone(); Func1::Shared(std::rc::Rc::new(move |a0: UnknownType| -> UnknownType { crate::Value::Func" <> show (a - 1) <> "(Func" <> show (a - 1) <> "::Shared(std::rc::Rc::new({ let f2 = f.clone(); move |" <> String.joinWith ", " (map (\i -> "mut a" <> show i <> ": UnknownType") (Array.range 1 (a - 1))) <> "| -> UnknownType { f2(a0.clone(), " <> String.joinWith ", " (map (\i -> "a" <> show i) (Array.range 1 (a - 1))) <> ") } }))) })) }") (Array.range 2 maxNativeFunctionArity)) <>
           " else { panic!(\"Expected Func1\"); }\n"
          else 
           let argsDecl = String.joinWith ", " (Array.mapWithIndex (\i _ -> "mut a" <> show i <> ": UnknownType") (Array.replicate arity unit))
               bodyInner = Array.foldl (\acc i -> acc <> ".unwrap_func1()(a" <> show i <> ")") "f(a0)" (Array.range 1 (arity - 1))
           in "        if let Value::Func" <> show arity <> "(v) = value { v.clone() } else if let Value::Func1(v) = value { let f = v.clone(); Func" <> show arity <> "::Shared(std::rc::Rc::new(move |" <> argsDecl <> "| -> UnknownType { " <> bodyInner <> " })) } else { panic!(\"Expected Func" <> show arity <> " or Func1 (curried) - got something else\"); }\n"
         ) <>
         "    }\n"
    ) (Array.range 1 maxNativeFunctionArity)

  in
  "#![allow(warnings)]\n\n" <>
  "use perceus_ptr::PerceusPtr;\n\n" <>
  "#[derive(Clone)]\npub enum Void {}\n\n" <>
  "#[derive(Clone)]\n" <>
  "pub enum Value {\n" <>
  "    Unit,\n" <>
  "    Null,\n" <>
  "    Int(i64),\n" <>
  "    Number(f64),\n" <>
  "    Bool(bool),\n" <>
  "    String(String),\n" <>
  "    Char(char),\n" <>
  "    Array(std::rc::Rc<Vec<UnknownType>>),\n" <>
  "    IntArray(std::rc::Rc<Vec<i64>>),\n" <>
  funcVariants <>
  "    Class(std::rc::Rc<dyn std::any::Any>),\n" <>
  "    Thunk(perceus_ptr::PerceusPtr<Thunk>),\n" <>
  "    Record_a(perceus_ptr::PerceusPtr<Record_a>),\n" <>
  "    DynamicRecord(perceus_ptr::PerceusPtr<RecordFields>),\n" <>
  recordVariants <>
  "}\n\n" <>
  "impl Value {\n" <>
  "    pub fn resolve(&self) -> &Self {\n" <>
  "        let mut value = self;\n" <>
  "        while let Value::Thunk(thunk) = value {\n" <>
  "            value = thunk.value.get().expect(\"recursive value used before initialization\");\n" <>
  "        }\n" <>
  "        value\n" <>
  "    }\n" <>
  "    pub fn unwrap_unit(&self) {\n" <>
  "        if !matches!(self.resolve(), Value::Unit) { panic!(\"Expected Unit\"); }\n" <>
  "    }\n" <>
  "    pub fn unwrap_int(&self) -> i64 {\n" <>
  "        if let Value::Int(v) = self.resolve() { *v } else { panic!(\"Expected Int\"); }\n" <>
  "    }\n" <>
  "    pub fn unwrap_number(&self) -> f64 {\n" <>
  "        // Foreign numbers can originate from a native PureScript Int.\n" <>
  "        match self.resolve() { Value::Number(v) => *v, Value::Int(v) => *v as f64, _ => panic!(\"Expected Number\") }\n" <>
  "    }\n" <>
  "    pub fn unwrap_bool(&self) -> bool {\n" <>
  "        if let Value::Bool(v) = self.resolve() { *v } else { panic!(\"Expected Bool\"); }\n" <>
  "    }\n" <>
  "    pub fn unwrap_string(&self) -> String {\n" <>
  "        if let Value::String(v) = self.resolve() { v.clone() } else { panic!(\"Expected String\"); }\n" <>
  "    }\n" <>
  "    pub fn unwrap_char(&self) -> char {\n" <>
  "        if let Value::Char(v) = self.resolve() { *v } else { panic!(\"Expected Char\"); }\n" <>
  "    }\n" <>
  -- An `Array Int` may keep its elements unboxed. Consumers that accept both
  -- representations go through the accessors and iterators below; the rest
  -- keep working through the boxed conversion in `unwrap_array`.
  "    pub fn unwrap_array(&self) -> std::rc::Rc<Vec<UnknownType>> {\n" <>
  "        match self.resolve() {\n" <>
  "            Value::Array(v) => v.clone(),\n" <>
  "            Value::IntArray(v) => std::rc::Rc::new(v.iter().map(|x| Value::Int(*x)).collect()),\n" <>
  "            _ => panic!(\"Expected Array\"),\n" <>
  "        }\n" <>
  "    }\n" <>
  "    pub fn is_array(&self) -> bool {\n" <>
  "        matches!(self.resolve(), Value::Array(_) | Value::IntArray(_))\n" <>
  "    }\n" <>
  "    pub fn int_array(&self) -> Option<std::rc::Rc<Vec<i64>>> {\n" <>
  "        match self.resolve() { Value::IntArray(v) => Some(v.clone()), _ => None }\n" <>
  "    }\n" <>
  -- The same view without walking thunks: a dispatch must not force a value
  -- the program would not otherwise have forced.
  "    pub fn int_array_now(&self) -> Option<std::rc::Rc<Vec<i64>>> {\n" <>
  "        match self { Value::IntArray(v) => Some(v.clone()), _ => None }\n" <>
  "    }\n" <>
  -- Libraries that inspect the raw element vector convert an IntArray on
  -- demand; the boxed buffer is a fresh copy because those callers index or
  -- mutate it directly.
  "    pub fn boxed_array_view(&self) -> Option<std::rc::Rc<Vec<UnknownType>>> {\n" <>
  "        match self.resolve() {\n" <>
  "            Value::Array(v) => Some(v.clone()),\n" <>
  "            Value::IntArray(v) => Some(std::rc::Rc::new(v.iter().map(|x| Value::Int(*x)).collect())),\n" <>
  "            _ => None,\n" <>
  "        }\n" <>
  "    }\n" <>
  -- Borrowing accessors: a length or element read must not clone the backing
  -- buffer reference, which would touch the refcount on every access.
  "    pub fn array_len(&self) -> usize {\n" <>
  "        match self.resolve() { Value::Array(v) => v.len(), Value::IntArray(v) => v.len(), _ => panic!(\"Expected Array\") }\n" <>
  "    }\n" <>
  "    pub fn array_get(&self, index: usize) -> UnknownType {\n" <>
  "        match self.resolve() {\n" <>
  "            Value::Array(v) => v[index].clone(),\n" <>
  "            Value::IntArray(v) => Value::Int(v[index]),\n" <>
  "            _ => panic!(\"Expected Array\"),\n" <>
  "        }\n" <>
  "    }\n" <>
  -- An `Array Int` read that already knows its element representation copies
  -- the integer instead of cloning the boxed element.
  "    pub fn array_get_int(&self, index: usize) -> i64 {\n" <>
  "        match self.resolve() {\n" <>
  "            Value::Array(v) => if let Value::Int(x) = &v[index] { *x } else { panic!(\"Expected Int element\"); },\n" <>
  "            Value::IntArray(v) => v[index],\n" <>
  "            _ => panic!(\"Expected Array\"),\n" <>
  "        }\n" <>
  "    }\n" <>
  funcUnwraps <>
  "    pub fn unwrap_class<T: 'static>(&self) -> &T {\n" <>
  "        if let Value::Class(v) = self.resolve() { v.downcast_ref::<T>().unwrap() } else { panic!(\"Expected Class\"); }\n" <>
  "    }\n" <>
  "    pub fn drop_explicit(self) {\n" <>
  "    }\n" <>
  "    pub fn __purust_ctor_tag(&self) -> &'static str {\n" <>
  "        if let Value::Record_a(r) = self.resolve() { r.tag } else { panic!(\"Expected Record_a for tag\"); }\n" <>
  "    }\n" <>
  getMethods <>
  dynamicGetMethod <>
  dynamicSetMethod <>
  recordEntriesMethod <>
  borrowMethods <>
  setMethods <>
  "}\n\n" <>
  "pub type UnknownType = Value;\n\n" <>
  runtimeHelpers <> ModuleValues.runtime <> RecordFields.runtime <>
  "pub fn mk_unit(_val: ()) -> UnknownType { Value::Unit }\n" <>
  "pub fn mk_int(val: i64) -> UnknownType { Value::Int(val) }\n" <>
  "pub fn mk_bool(val: bool) -> UnknownType { Value::Bool(val) }\n" <>
  "pub fn mk_number(val: f64) -> UnknownType { Value::Number(val) }\n" <>
  "pub fn mk_string(val: &str) -> UnknownType { Value::String(val.to_string()) }\n" <>
  "pub fn mk_char(val: char) -> UnknownType { Value::Char(val) }\n" <>
  "pub fn mk_array(val: Vec<UnknownType>) -> UnknownType { Value::Array(std::rc::Rc::new(val)) }\n\n" <>
  "pub fn mk_int_array(val: Vec<i64>) -> UnknownType { Value::IntArray(std::rc::Rc::new(val)) }\n\n" <>
  reprItemsSource <>
  "#[derive(Clone, Default)]\npub struct Thunk {\n" <>
  "    pub value: std::sync::OnceLock<Value>,\n" <>
  "}\n\n" <>
  "#[derive(Clone, Default)]\npub struct Record_a {\n" <>
  "    pub tag: &'static str,\n" <>
  "    pub vals: Option<std::rc::Rc<Vec<UnknownType>>>,\n" <>
  "    pub call: Option<Func1<UnknownType, UnknownType>>,\n" <>
  Array.foldMap (\field ->
    "    pub " <> recordFieldIdent renames field <> ": Option<UnknownType>,\n"
  ) genericFields <>
  "}\n\n" <>
  recordStructs <>
  "\n\n" <>
  funcWrappers <>
  typedTraversalsSource
    
unwrapType :: ExprType -> ExprType
unwrapType (ForAll _ t) = unwrapType t
unwrapType (CoreFn.TypeApp t _) = unwrapType t
unwrapType (TypeVar _) = Any
unwrapType (ConstrainedType cs t) = 
  let csArgs = map (\(Tuple fqn args) -> 
        let className = fromMaybe "" (Array.last fqn)
        in ADT className fqn args) cs
  in case unwrapType t of
    Func args retTy -> Func (csArgs <> args) retTy
    other -> Func csArgs other
unwrapType t = t

debugUnwrap :: String -> ExprType -> ExprType
debugUnwrap name t = 
  let unwrapped = unwrapType t
  in unwrapped

printType :: ExprType -> String
printType (Func _ _) = "Func"
printType (ForAll _ t) = "ForAll(" <> printType t <> ")"
printType (ConstrainedType _ t) = "ConstrainedType(" <> printType t <> ")"
printType (CoreFn.TypeApp a _) = "TypeApp(" <> printType a <> ", [...])"
printType (TypeVar n) = "TypeVar"
printType (Int) = "Int"
printType (Boolean) = "Boolean"
printType Any = "Any"
printType _ = "Other"

codegenExprType :: String -> Boolean -> ExprType -> String
codegenExprType = codegenExprTypeWithValueEnums Set.empty

codegenExprTypeWithValueEnums :: ValueEnums -> String -> Boolean -> ExprType -> String
codegenExprTypeWithValueEnums valueEnums currentMod isRet ty = case unwrapType ty of
  Unit -> "()"
  Int -> "i64"
  Boolean -> "bool"
  Number -> "f64"
  String -> "String"
  Char -> "char"
  ADT className fqn _ -> 
    let modName = String.replaceAll (Pattern ".") (Replacement "_") (String.joinWith "_" (Array.dropEnd 1 fqn))
        actualClassName = fromMaybe className (Array.last fqn)
    -- Pipes' recursive newtype X = X X has no finite inhabitant and no
    -- dataDecl layout. Use the native empty type, not a missing Rc<X>.
    in if actualClassName == "Void" || (modName == "Pipes_Internal" && actualClassName == "X") then "purust_core::Void"
       else if modName == "Prim" || String.indexOf (Pattern "Prim_") modName == Just 0 || String.indexOf (Pattern "Prim") modName == Just 0 then "crate::UnknownType"
           else if modName == "Effect" || modName == "Effect_Exception" || modName == "Effect_Console" || modName == "Effect_Ref" || modName == "Effect_Uncurried" || modName == "Control_Monad_ST_Internal" || modName == "Data_Array_ST" then "crate::UnknownType"
           -- Only the opaque Foreign carrier uses Value. ForeignError has a
           -- recursive native ADT layout, including its constructor fields.
           else if modName == "Foreign" && actualClassName == "Foreign" then "crate::UnknownType"
           -- A rejection is the original arbitrary value, not an Error wrapper.
           -- Promise.Aff also reads string rejections through unsafeToForeign.
           else if modName == "Promise_Rejection" && actualClassName == "Rejection" then "crate::UnknownType"
           -- Preserve the Aff runtime ABI without erasing native dictionary
           -- layouts in sibling modules such as Effect.Aff.Class.
           else if modName == "Effect_Aff" || modName == "Effect_Aff_AVar" || modName == "Effect_Aff_Compat" then "crate::UnknownType"
           -- Exists hides its parameter but preserves the contained value; it
           -- has no constructor or native struct to allocate.
           else if modName == "Data_Exists" && actualClassName == "Exists" then "crate::UnknownType"
           -- VariantCase carries heterogeneous payloads and their comparators
           -- through unsafeCoerce. Preserve the contained Value, not Rc<opaque>;
           -- Both case carriers retain their payload; dictionaries stay native.
           else if modName == "Data_Variant_Internal" && (actualClassName == "VariantCase" || actualClassName == "VariantFCase") then "crate::UnknownType"
           -- The public row variant is the { type, value } record transported
           -- by VariantRep, not a native ADT or one of Variant's dictionaries.
           else if modName == "Data_Variant" && actualClassName == "Variant" then "crate::UnknownType"
           -- VariantFRep also transports its mapper alongside type and value.
           else if modName == "Data_Functor_Variant" && actualClassName == "VariantF" then "crate::UnknownType"
           -- Free's private, constructorless Val stores heterogeneous bind
           -- payloads via unsafeCoerce. Only this carrier uses Value; Free,
           -- FreeView and the Step constructors keep their native layouts.
           else if modName == "Control_Monad_Free" && actualClassName == "Val" then "crate::UnknownType"
           else if (modName == "Data_Function_Uncurried" || modName == "Control_Monad_ST_Uncurried") && (String.indexOf (Pattern "Fn") actualClassName == Just 0 || String.indexOf (Pattern "STFn") actualClassName == Just 0) then "crate::UnknownType"
           -- A foreign import data type with no Rust FFI binding has no native
           -- layout; values cross through unsafeCoerce as boxed runtime Values.
           else if isOpaqueForeignType valueEnums modName actualClassName then "crate::UnknownType"
           else if isValueEnum valueEnums modName actualClassName then
             (if modName == currentMod then "crate::" else "Purs_" <> modName <> "::") <> sanitizeIdent actualClassName
           else if modName == currentMod then "std::rc::Rc<crate::" <> sanitizeIdent actualClassName <> ">"
           else "std::rc::Rc<Purs_" <> modName <> "::" <> sanitizeIdent actualClassName <> ">"
  Func args ret -> 
    let arity = Array.length args
        argStrs = map (codegenExprTypeWithValueEnums valueEnums currentMod false) args
        retStr = codegenExprTypeWithValueEnums valueEnums currentMod true ret
        typeArgs = String.joinWith ", " (argStrs <> [retStr])
    in if arity > 0 && arity <= maxNativeFunctionArity then "purust_core::Func" <> show arity <> "<" <> typeArgs <> ">"
       else "crate::UnknownType"
  _ -> "crate::UnknownType"

-- A tail-call jump has no value to box. Detect it from the expression rather
-- than the emitted Rust suffix: moving constructor fields can add outer blocks.
continuesLoop :: String -> Maybe LoopContext -> NeutralExpr -> Boolean
continuesLoop currentMod mbLoop = go
  where
  callee (NeutralExpr (Typed _ inner)) = callee inner
  callee (NeutralExpr (Syn.TypeApp inner _)) = callee inner
  callee (NeutralExpr (Var qualified@(Qualified _ (Ident name)))) =
    Just (getTyPrefix currentMod qualified <> sanitizeIdent name)
  callee (NeutralExpr (Local (Just (Ident name)) _)) = Just (sanitizeIdent name)
  callee _ = Nothing

  go (NeutralExpr syntax) = case syntax of
    Typed _ inner -> go inner
    Syn.TypeApp inner _ -> go inner
    Let _ _ _ body -> go body
    LetRec _ _ body -> go body
    Branch branches fallback -> go fallback && Array.all (\(Pair _ body) -> go body) (NonEmptyArray.toArray branches)
    App fn args -> case mbLoop, callee fn of
      Just loop, Just name -> name == loop.name && NonEmptyArray.length args == Array.length loop.params
      _, _ -> false
    _ -> false

boxUnbox :: Map.Map String String -> ValueEnums -> Map.Map String (Array (Tuple String ExprType)) -> String -> ExprType -> ExprType -> String -> String
boxUnbox renames valueEnums globalClassFields currentMod expected actual code =
  let
    expStr = codegenExprTypeWithValueEnums valueEnums currentMod true expected
    actStr = codegenExprTypeWithValueEnums valueEnums currentMod true actual
    _ = if expStr == "crate::UnknownType" && actStr == "std::rc::Rc<dyn Fn(crate::UnknownType) -> crate::UnknownType>" then Debug.trace ("BOXUNBOX DEBUG: expStr=" <> expStr <> " actStr=" <> actStr <> " expTy=" <> printType expected <> " actTy=" <> printType actual <> " expStr==actStr is " <> show (expStr == actStr)) \_ -> unit else unit
  in
    if String.indexOf (Pattern "unimplemented!()") code == Just 0 || (String.indexOf (Pattern "/* Typed ") code == Just 0 && String.contains (Pattern "unimplemented!()") code && not (String.contains (Pattern "\n") code)) then code
    else if String.drop (String.length code - 15) code == "continue;\n    }" then code
    else if expStr == actStr then code
    else case unwrapType expected, unwrapType actual of
      Func expArgs expRet, Func actArgs actRet ->
        let expArity = Array.length expArgs
            actArity = Array.length actArgs
        in if expArity == actArity && expArity > 0 && expArity <= maxNativeFunctionArity then
             let
               expArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) expArgs
               actArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) actArgs
               argsDecl = String.joinWith ", " (Array.mapWithIndex (\i ty -> "mut _a" <> show i <> ": " <> ty) expArgTypes)
               argsCall = String.joinWith ", " (Array.mapWithIndex (\i (Tuple expTy actTy) -> boxUnbox renames valueEnums globalClassFields currentMod actTy expTy ("_a" <> show i)) (Array.zip expArgs actArgs))
               retStr = codegenExprTypeWithValueEnums valueEnums currentMod true expRet
             in "purust_core::Func" <> show expArity <> "::Shared(std::rc::Rc::new({ let _f = (" <> code <> ").clone(); move |" <> argsDecl <> "| -> " <> retStr <> " { " <> boxUnbox renames valueEnums globalClassFields currentMod expRet actRet ("_f(" <> argsCall <> ")") <> " } }))"
           else if actArity > expArity && expArity > 0 && actArity <= maxNativeFunctionArity then
             let
               expArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) expArgs
               argsDecl = String.joinWith ", " (Array.mapWithIndex (\i ty -> "mut _a" <> show i <> ": " <> ty) expArgTypes)
               retStr = codegenExprTypeWithValueEnums valueEnums currentMod true expRet
               
               remainingActArgs = Array.drop expArity actArgs
               remArity = Array.length remainingActArgs
               remArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) remainingActArgs
               remArgsDecl = String.joinWith ", " (Array.mapWithIndex (\i ty -> "mut _a" <> show (expArity + i) <> ": " <> ty) remArgTypes)
               remRetStr = codegenExprTypeWithValueEnums valueEnums currentMod true actRet
               
               allArgsCall = String.joinWith ", " (Array.mapWithIndex (\i actTy -> 
                 let paramTy = fromMaybe Any (Array.index (expArgs <> remainingActArgs) i)
                 in boxUnbox renames valueEnums globalClassFields currentMod actTy paramTy ("_a" <> show i <> ".clone()")
               ) actArgs)
               
               innerClosure = "purust_core::Func" <> show remArity <> "::Shared(std::rc::Rc::new({ let _f2 = _f.clone(); " <> String.joinWith " " (Array.mapWithIndex (\i _ -> "let mut _a" <> show i <> " = _a" <> show i <> ".clone();") expArgs) <> " move |" <> remArgsDecl <> "| -> " <> remRetStr <> " { _f2(" <> allArgsCall <> ") } }))"
               
             in "purust_core::Func" <> show expArity <> "::Shared(std::rc::Rc::new({ let _f = (" <> code <> ").clone(); move |" <> argsDecl <> "| -> " <> retStr <> " { " <> boxUnbox renames valueEnums globalClassFields currentMod expRet (Func remainingActArgs actRet) innerClosure <> " } }))"
           else
             let
               expArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) expArgs
               argsDecl = String.joinWith ", " (Array.mapWithIndex (\i ty -> "mut _a" <> show i <> ": " <> ty) expArgTypes)
               retStr = codegenExprTypeWithValueEnums valueEnums currentMod true expRet
               
               buildCall :: Int -> ExprType -> String -> Tuple ExprType String
               buildCall idx currentTy accCode = 
                 if idx >= expArity then Tuple currentTy accCode
                 else 
                   case unwrapType currentTy of
                     Func actArgTys actRetTy ->
                       let stepArity = Array.length actArgTys
                           -- consume 'stepArity' arguments from expArgs
                           argsToPass = Array.slice idx (idx + stepArity) expArgs
                           argsStrs = Array.mapWithIndex (\i paramTy -> 
                               let actArgTy = fromMaybe Any (Array.index actArgTys i)
                               in boxUnbox renames valueEnums globalClassFields currentMod actArgTy paramTy ("_a" <> show (idx + i) <> ".clone()")
                             ) argsToPass
                           nextCode = "(" <> accCode <> ")(" <> String.joinWith ", " argsStrs <> ")"
                       in buildCall (idx + stepArity) actRetTy nextCode
                     _ -> 
                       -- currentTy is Any (Value), so it must be unwrapped
                       let paramTy = fromMaybe Any (Array.index expArgs idx)
                           boxedArg = boxUnbox renames valueEnums globalClassFields currentMod Any paramTy ("_a" <> show idx <> ".clone()")
                           nextCode = "(" <> accCode <> ").unwrap_func1()(" <> boxedArg <> ")"
                       in buildCall (idx + 1) Any nextCode
                   
               Tuple finalActRet allArgsCall = buildCall 0 (Func actArgs actRet) "_f"
             in "purust_core::Func" <> show expArity <> "::Shared(std::rc::Rc::new({ let _f = (" <> code <> ").clone(); move |" <> argsDecl <> "| -> " <> retStr <> " { " <> boxUnbox renames valueEnums globalClassFields currentMod expRet finalActRet allArgsCall <> " } }))"
      
      Func expArgs expRet, _ ->
        let arity = Array.length expArgs
            -- When the boxed function already has the expected Value-level
            -- signature, unwrap it directly. The general path below would
            -- allocate an Rc closure whose body only forwards its arguments.
            alreadyBoxed = arity > 0
              && Array.all (\expTy -> codegenExprTypeWithValueEnums valueEnums currentMod false expTy == "crate::UnknownType") expArgs
              && codegenExprTypeWithValueEnums valueEnums currentMod true expRet == "crate::UnknownType"
        in if (actStr == "crate::UnknownType" || actStr == "purust_core::Value") && arity > 0 && arity <= maxNativeFunctionArity then
             if alreadyBoxed then "(" <> code <> ").unwrap_func" <> show arity <> "()"
             else
               let
                 expArgTypes = map (codegenExprTypeWithValueEnums valueEnums currentMod false) expArgs
                 argsDecl = String.joinWith ", " (Array.mapWithIndex (\i ty -> "mut _a" <> show i <> ": " <> ty) expArgTypes)
                 argsCall = String.joinWith ", " (Array.mapWithIndex (\i expTy -> boxUnbox renames valueEnums globalClassFields currentMod Any expTy ("_a" <> show i)) expArgs)
                 retStr = codegenExprTypeWithValueEnums valueEnums currentMod true expRet
               in "purust_core::Func" <> show arity <> "::Shared(std::rc::Rc::new({ let _f = (" <> code <> ").unwrap_func" <> show arity <> "(); move |" <> argsDecl <> "| -> " <> retStr <> " { " <> boxUnbox renames valueEnums globalClassFields currentMod expRet Any ("_f(" <> argsCall <> ")") <> " } }))"
           else code

      _, Func actArgs actRet ->
        let arity = Array.length actArgs
            -- A function already typed at Value level keeps its Static/Shared
            -- variant instead of gaining an Rc forwarding closure, so the
            -- callee can still dispatch statically after unwrap_funcN.
            alreadyBoxed = arity > 0
              && Array.all (\actTy -> codegenExprTypeWithValueEnums valueEnums currentMod false actTy == "crate::UnknownType") actArgs
              && codegenExprTypeWithValueEnums valueEnums currentMod true actRet == "crate::UnknownType"
        in if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && arity > 0 && arity <= maxNativeFunctionArity then
             if alreadyBoxed then "purust_core::Value::Func" <> show arity <> "(" <> code <> ")"
             else
               let
                 argsDecl = String.joinWith ", " (Array.mapWithIndex (\i _ -> "mut _a" <> show i <> ": crate::UnknownType") actArgs)
                 argsCall = String.joinWith ", " (Array.mapWithIndex (\i actTy -> boxUnbox renames valueEnums globalClassFields currentMod actTy Any ("_a" <> show i)) actArgs)
               in "purust_core::Value::Func" <> show arity <> "(purust_core::Func" <> show arity <> "::Shared(std::rc::Rc::new({ let _f = (" <> code <> ").clone(); move |" <> argsDecl <> "| -> crate::UnknownType { " <> boxUnbox renames valueEnums globalClassFields currentMod Any actRet ("_f(" <> argsCall <> ")") <> " } })))"
           else code

      _, _ ->
        let isActADT = case unwrapType actual of 
              ADT _ _ _ -> true
              _ -> false
            isExpADT = case unwrapType expected of
              ADT _ _ _ -> true
              _ -> false
        in if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && isActADT then "purust_core::Value::Class(std::rc::Rc::new(" <> code <> "))"
        else if (actStr == "crate::UnknownType" || actStr == "purust_core::Value") && isExpADT then
          let downcast value = "(" <> value <> ").unwrap_class::<" <> expStr <> ">().clone()"
          in case unwrapType expected of
            ADT className fqn _ ->
              let modName = String.replaceAll (Pattern ".") (Replacement "_")
                    (String.joinWith "_" (Array.dropEnd 1 fqn))
                  name = sanitizeIdent (fromMaybe className (Array.last fqn))
                  nativeName = (if modName == currentMod then "crate::" else "Purs_" <> modName <> "::") <> name
              in if modName == "Foreign_Object" && name == "Object" then
                "(" <> code <> ").__purust_foreign_object()"
              else case Map.lookup (modName <> "_" <> name) globalClassFields of
                Nothing -> downcast code
                Just fields ->
                  let fieldValues = map (\(Tuple field fieldType) ->
                        let projection = "__purust_class_value.__purust_get_field(" <> show field <> ")"
                            message = show ("Missing field " <> field <> " for class " <> name)
                            converted = case unwrapType fieldType of
                              Func arguments result | Array.length arguments > 0 && Array.length arguments <= maxNativeFunctionArity ->
                                -- TAST can omit an unused dictionary. Preserve that
                                -- laziness: a missing method fails only if called.
                                let parameters = Array.mapWithIndex (\index argument -> "_argument_" <> show index <> ": " <>
                                      codegenExprTypeWithValueEnums valueEnums currentMod false argument) arguments
                                in "match " <> projection <> " { Some(__purust_method) => " <>
                                  boxUnbox renames valueEnums globalClassFields currentMod fieldType Any "__purust_method" <>
                                  ", None => purust_core::Func" <> show (Array.length arguments) <>
                                  "::Static(|" <> String.joinWith ", " parameters <> "| -> " <>
                                  codegenExprTypeWithValueEnums valueEnums currentMod true result <> " { panic!(" <> message <> ") }) }"
                              _ -> boxUnbox renames valueEnums globalClassFields currentMod fieldType Any (projection <> ".expect(" <> message <> ")")
                        in recordFieldIdent renames field <> ": " <> converted
                      ) fields
                  in "{ let __purust_class_value = " <> code <> "; " <>
                     "if matches!(__purust_class_value.resolve(), purust_core::Value::Class(_)) { " <>
                     downcast "__purust_class_value" <> " } else { std::rc::Rc::new(" <>
                     nativeName <> " { " <> String.joinWith ", " fieldValues <> " }) } }"
            _ -> downcast code
        else if expStr == "()" && actStr == "crate::UnknownType" then "(" <> code <> ").unwrap_unit()"
        else if expStr == "crate::UnknownType" && actStr == "()" then "crate::mk_unit(" <> code <> ")"
        else if expStr == "i64" && (actStr == "crate::UnknownType" || actStr == "purust_core::Value") then "(" <> code <> ").unwrap_int()"
        else if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && actStr == "i64" then "crate::mk_int(" <> code <> ")"
        else if expStr == "bool" && (actStr == "crate::UnknownType" || actStr == "purust_core::Value") then "(" <> code <> ").unwrap_bool()"
        else if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && actStr == "bool" then "crate::mk_bool(" <> code <> ")"
        else if expStr == "f64" && (actStr == "crate::UnknownType" || actStr == "purust_core::Value") then "(" <> code <> ").unwrap_number()"
        else if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && actStr == "f64" then "crate::mk_number(" <> code <> ")"
        else if expStr == "char" && (actStr == "crate::UnknownType" || actStr == "purust_core::Value") then "(" <> code <> ").unwrap_char()"
        else if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && actStr == "char" then "crate::mk_char(" <> code <> ")"
        else if expStr == "String" && (actStr == "crate::UnknownType" || actStr == "purust_core::Value") then "(" <> code <> ").unwrap_string()"
        -- An owned String gives a diverging expression a sized expected type.
        -- Borrowing it as &str first makes Rust infer an unsized `str` for !.
        else if (expStr == "crate::UnknownType" || expStr == "purust_core::Value") && actStr == "String" then "purust_core::Value::String(" <> code <> ")"
        else code

extractAllArgTypes :: ExprType -> Array ExprType
extractAllArgTypes ty = case unwrapType ty of
  Func args _ -> args
  _ -> []

extractFinalRetType :: ExprType -> ExprType
extractFinalRetType ty = case unwrapType ty of
  Func _ retTy -> retTy
  other -> other

-- A single App can supply parameters of both a function and its result.
applicationResultType :: Int -> ExprType -> ExprType
applicationResultType 0 ty = ty
applicationResultType count ty = case unwrapType ty of
  Func args result ->
    if count < Array.length args then Func (Array.drop count args) result
    else applicationResultType (count - Array.length args) result
  _ -> Any

extractAbsParams :: Int -> NeutralExpr -> Maybe (Tuple (Array String) NeutralExpr)
extractAbsParams 0 expr = Just (Tuple [] expr)
extractAbsParams n (NeutralExpr (Typed _ expr)) = extractAbsParams n expr
extractAbsParams n (NeutralExpr (Abs params body)) = 
  let pNames = map (\(Tuple mbId lvl) -> case mbId of
                 Just (Ident x) -> sanitizeIdent x
                 Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
      len = Array.length pNames
  in if n >= len then
       case extractAbsParams (n - len) body of
         Just (Tuple rest inner) -> Just (Tuple (pNames <> rest) inner)
         Nothing -> Nothing
     else Nothing
extractAbsParams n (NeutralExpr (Let ident ty val body)) =
  case extractAbsParams n body of
    Just (Tuple rest inner) -> Just (Tuple rest (NeutralExpr (Let ident ty val inner)))
    Nothing -> Nothing
extractAbsParams _ _ = Nothing

-- Count consecutive lambda binders. Stop before a let or branch that
-- computes a function-valued result.
leadingAbsArity :: NeutralExpr -> Int
leadingAbsArity (NeutralExpr (Typed _ inner)) = leadingAbsArity inner
leadingAbsArity (NeutralExpr (Abs params body)) = NonEmptyArray.length params + leadingAbsArity body
leadingAbsArity _ = 0

-- Apply an already-emitted function value to a binding's remaining
-- parameters, boxing every argument to the expected type. Call sites use this
-- instead of building a `FuncN::Shared(Rc::new(...))` closure and applying it
-- immediately, which allocated on every call.
buildCallBindingGroupAt :: Map.Map String String -> ValueEnums -> Map.Map String (Array (Tuple String ExprType)) -> String -> Array (Tuple ExprType String) -> ExprType -> String -> Int -> Tuple ExprType String
buildCallBindingGroupAt renames valueEnums globalClassFields currentMod argsCodeAndType = go
  where
  go accTy accCode idx = if idx >= Array.length argsCodeAndType then Tuple accTy accCode else
    case unwrapType accTy of
      Func argTys retTy ->
        let arity = Array.length argTys
        in if arity > 0 && arity <= maxNativeFunctionArity then
             let availableArgsCount = Array.length argsCodeAndType - idx
             in if availableArgsCount >= arity then
                  let passedArgs = Array.slice idx (idx + arity) argsCodeAndType
                      boxedArgs = Array.mapWithIndex (\i (Tuple argTy argCode) ->
                          let expectedTy = fromMaybe Any (Array.index argTys i)
                          in boxUnbox renames valueEnums globalClassFields currentMod expectedTy argTy argCode
                        ) passedArgs
                      nextCode = "(" <> accCode <> ")(" <> String.joinWith ", " boxedArgs <> ")"
                  in go retTy nextCode (idx + arity)
                else
                  let (Tuple argTy argCode) = fromMaybe (Tuple Any "") (Array.index argsCodeAndType idx)
                  in go Any ("(" <> accCode <> ").unwrap_func1()(" <> boxUnbox renames valueEnums globalClassFields currentMod Any argTy argCode <> ")") (idx + 1)
           else
             let (Tuple argTy argCode) = fromMaybe (Tuple Any "") (Array.index argsCodeAndType idx)
             in go Any ("(" <> accCode <> ").unwrap_func1()(" <> boxUnbox renames valueEnums globalClassFields currentMod Any argTy argCode <> ")") (idx + 1)
      _ ->
        let (Tuple argTy argCode) = fromMaybe (Tuple Any "") (Array.index argsCodeAndType idx)
        in go Any ("(" <> accCode <> ").unwrap_func1()(" <> boxUnbox renames valueEnums globalClassFields currentMod Any argTy argCode <> ")") (idx + 1)

-- Rebuild the function type a body expression actually returns: nested
-- lambdas keep their curried grouping, while a direct accessor or global keeps
-- the flat remaining signature.
shapeFunctionType :: String -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> ExprType -> NeutralExpr -> ExprType
shapeFunctionType modNameStr aritiesMap globalClassFields bound = go
  where
  go currentTy expr = case expr of
    NeutralExpr (Typed _ _) -> inferTypeExpr modNameStr aritiesMap globalClassFields bound expr
    NeutralExpr (Syn.TypeApp _ _) -> inferTypeExpr modNameStr aritiesMap globalClassFields bound expr
    NeutralExpr (Abs params body) ->
      let
        expectedArgs = extractAllArgTypes currentTy
        arity = NonEmptyArray.length params
        paramTys = Array.take arity expectedArgs
        restArgs = Array.drop arity expectedArgs
        retTy = extractFinalRetType currentTy
        bodyExpectedTy = if Array.length restArgs > 0 then Func restArgs retTy else retTy
      in Func paramTys (go bodyExpectedTy body)
    NeutralExpr (UncurriedAbs params body) ->
      let
        expectedArgs = extractAllArgTypes currentTy
        arity = Array.length params
        paramTys = Array.take arity expectedArgs
        restArgs = Array.drop arity expectedArgs
        retTy = extractFinalRetType currentTy
        bodyExpectedTy = if Array.length restArgs > 0 then Func restArgs retTy else retTy
      in Func paramTys (go bodyExpectedTy body)
    _ -> currentTy

codegenBindingGroup :: { threaded :: Boolean, moduleValues :: Set Ident, fieldRenames :: Map.Map String String } -> ValueEnums -> ModuleName -> String -> Set.Set String -> ReuseContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> BackendBindingGroup Ident NeutralExpr -> { code :: String, arities :: Map.Map String ExprType }
codegenBindingGroup options valueEnums modName modNameStr allZeroArity reuseContext aritiesMap globalClassFields group = unsafePerformEffect do
  let renames = options.fieldRenames
  Ref.write Set.empty globalConsumed
  pure $ if Array.null group.bindings then { code: "", arities: aritiesMap } else
    let
      isSelfRecursive = group.recursive && Array.length group.bindings == 1
      groupArities = Map.fromFoldable $ map (\(Tuple ident expr) -> 
        let rawIdentName = case ident of
              Ident i -> sanitizeIdent i
              _ -> "unknown"
            identName = modNameStr <> "_" <> rawIdentName
            inferredTy = inferTypeExpr modNameStr aritiesMap globalClassFields Map.empty expr
        in Tuple identName inferredTy
      ) group.bindings
      
      mergedArities = Map.union aritiesMap groupArities
      
      code = foldMap (\(Tuple ident expr) ->
      let
        rawIdentName = case ident of
          Ident i -> sanitizeIdent i
          _ -> "unknown"
        identName = modNameStr <> "_" <> rawIdentName
        inferredType = fromMaybe Any (Map.lookup identName mergedArities)
        innerExpr = case expr of
           NeutralExpr (Typed _ inner) -> inner
           NeutralExpr inner -> NeutralExpr inner
           _ -> expr
        { paramsCode, retCode, bodyCode, isFunc } =
          let allArgTypes = extractAllArgTypes inferredType
          in if Array.length allArgTypes > 0 then
            let
              retType = extractFinalRetType inferredType
              argTypes = allArgTypes
              extracted = extractAbsParams (Array.length argTypes) innerExpr
              isMatchingAbs = case extracted of
                Just _ -> true
                Nothing -> false
              paramsArr = case extracted of
                Just (Tuple p _) -> p
                Nothing -> Array.mapWithIndex (\i _ -> "a" <> show i) argTypes
              deduped = dedupArgs paramsArr
              mbLoop = if isSelfRecursive then Just { name: identName, params: deduped, view: Nothing, tco: true } else Nothing
              paramPairs = Array.zip deduped argTypes
              pCode = String.joinWith ", " $ map (\(Tuple pName ty) ->
                let p = sanitizeIdent pName in
                (if p == "_" then "" else "mut ") <> p <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr true ty) paramPairs
              bound = Map.fromFoldable (map (\(Tuple k v) -> Tuple (if k == "_" then "_" else sanitizeIdent k) v) paramPairs)
              bodyCodeRaw = case extracted of
                Just (Tuple _ body) -> 
                    let bodyRaw = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext mbLoop mergedArities globalClassFields bound Set.empty false body
                        bodyTy = inferTypeExpr modNameStr mergedArities globalClassFields bound body
                    in if continuesLoop modNameStr mbLoop body then bodyRaw
                       else boxUnbox renames valueEnums globalClassFields modNameStr retType bodyTy bodyRaw
                Nothing
                  | isSelfRecursive
                  , prefixArity <- leadingAbsArity expr
                  , prefixArity > 0
                  , remainingTypes <- Array.drop prefixArity argTypes
                  , not (Array.null remainingTypes)
                  , Array.length remainingTypes <= maxNativeFunctionArity
                  , Just (Tuple prefixParams body) <- extractAbsParams prefixArity expr ->
                      let
                        -- Preserve the public ABI. Within this wrapper, the
                        -- same name resolves to a worker returning the actual
                        -- function value. Recursive calls use its native arity.
                        workerParams = dedupArgs prefixParams
                        workerTypes = Array.take prefixArity argTypes
                        workerReturn = Func remainingTypes retType
                        workerType = Func workerTypes workerReturn
                        workerArities = Map.insert identName workerType mergedArities
                        workerBound = Map.fromFoldable (Array.zip workerParams workerTypes)
                        workerLoop = Just { name: identName, params: workerParams, view: Nothing, tco: true }
                        workerBody = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext workerLoop workerArities globalClassFields workerBound Set.empty false body
                        workerBodyType = inferTypeExpr modNameStr workerArities globalClassFields workerBound body
                        workerCode = if continuesLoop modNameStr workerLoop body then workerBody
                          else boxUnbox renames valueEnums globalClassFields modNameStr workerReturn workerBodyType workerBody
                        workerArgs = String.joinWith ", " $ Array.zipWith
                          (\name ty -> (if name == "_" then "" else "mut ") <> name <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr false ty)
                          workerParams workerTypes
                        passedArgs = map (\name -> name <> ".clone()") deduped
                        call = identName <> "(" <> String.joinWith ", " (Array.take prefixArity passedArgs) <> ")"
                        fallback =
                          "{\nfn " <> identName <> "(" <> workerArgs <> ") -> "
                          <> codegenExprTypeWithValueEnums valueEnums modNameStr true workerReturn <> " {\n"
                          <> "    loop {\n        break " <> workerCode <> ";\n    }\n}\n"
                          <> "(" <> call <> ")(" <> String.joinWith ", " (Array.drop prefixArity passedArgs) <> ")\n}"
                      in case deduped, argTypes, retType of
                        [count, callback, seed], [Int, Func [Int] Int, Int], Int
                          | Set.member identName reuseContext.functionIterators ->
                            "if " <> count <> " >= 0 { let mut _function_count = " <> count <>
                            "; let mut _function_result = " <> seed <> "; while _function_count > 0 { " <>
                            "_function_result = (" <> callback <> ")(_function_result); _function_count -= 1; } " <>
                            "_function_result } else " <> fallback
                        _, _, _ -> fallback
                -- Partial eta expansion: the binding body is a lambda with
                -- fewer parameters than the public arity (class accessors such
                -- as `\\dict -> dict.add`). Emit the body and apply the
                -- remaining public parameters directly instead of building and
                -- calling a closure, which allocated on every call.
                Nothing
                  | not isSelfRecursive
                  , prefixArity <- leadingAbsArity expr
                  , prefixArity > 0
                  , prefixArity < Array.length argTypes
                  , Just (Tuple prefixParams body) <- extractAbsParams prefixArity expr ->
                      let
                        prefixTypes = Array.take prefixArity argTypes
                        remainingTypes = Array.drop prefixArity argTypes
                        prefixNames = prefixParams
                        prefixBound = Map.fromFoldable (Array.filter (\(Tuple name _) -> name /= "_")
                          (Array.zip prefixNames prefixTypes))
                        captures = Array.mapWithIndex (\i ty -> "    let __purust_arg_" <> show i <> ": " <>
                          codegenExprTypeWithValueEnums valueEnums modNameStr true ty <> " = a" <> show (prefixArity + i) <> ".clone();\n") remainingTypes
                        aliases = Array.mapWithIndex (\i name -> if name == "_" then "" else "    let " <> name <> " = a" <> show i <> ";\n") prefixNames
                        bodyCode = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext Nothing mergedArities globalClassFields prefixBound Set.empty false body
                        bodyBaseTy = if Array.length remainingTypes > 0 then Func remainingTypes retType else retType
                        bodyExpectedTy = shapeFunctionType modNameStr mergedArities globalClassFields prefixBound bodyBaseTy body
                        remainingArgs = Array.mapWithIndex (\i ty -> Tuple ty ("__purust_arg_" <> show i <> ".clone()")) remainingTypes
                        Tuple actualRetTy callCode = buildCallBindingGroupAt renames valueEnums globalClassFields modNameStr remainingArgs bodyExpectedTy bodyCode 0
                      in foldMap identity captures <> foldMap identity aliases <> boxUnbox renames valueEnums globalClassFields modNameStr retType actualRetTy callCode
                Nothing -> 
                   let shapeTypeToAST :: ExprType -> NeutralExpr -> ExprType
                       -- Typed applications may retain a flattened public
                       -- signature while emitting a unary partial application.
                       -- Use the same representation inference as codegenExpr_.
                       shapeTypeToAST _ typed@(NeutralExpr (Typed _ _)) =
                         inferTypeExpr modNameStr mergedArities globalClassFields bound typed
                       shapeTypeToAST _ typed@(NeutralExpr (Syn.TypeApp _ _)) =
                         inferTypeExpr modNameStr mergedArities globalClassFields bound typed
                       shapeTypeToAST currentTy (NeutralExpr (Abs params body)) = 
                         let expectedArgs = extractAllArgTypes currentTy
                             arity = NonEmptyArray.length params
                             paramTys = Array.take arity expectedArgs
                             restArgs = Array.drop arity expectedArgs
                             retTy = extractFinalRetType currentTy
                             bodyExpectedTy = if Array.length restArgs > 0 then Func restArgs retTy else retTy
                         in Func paramTys (shapeTypeToAST bodyExpectedTy body)
                       shapeTypeToAST currentTy (NeutralExpr (UncurriedAbs params body)) = 
                         let expectedArgs = extractAllArgTypes currentTy
                             arity = Array.length params
                             paramTys = Array.take arity expectedArgs
                             restArgs = Array.drop arity expectedArgs
                             retTy = extractFinalRetType currentTy
                             bodyExpectedTy = if Array.length restArgs > 0 then Func restArgs retTy else retTy
                         in Func paramTys (shapeTypeToAST bodyExpectedTy body)
                       shapeTypeToAST currentTy _ = currentTy
                       
                       -- Eta expansion needs the binding's parameter types,
                       -- including when only one Typed wrapper remains.
                       fnCode = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext Nothing mergedArities globalClassFields bound Set.empty false expr
                       fnTy = shapeTypeToAST inferredType expr
                       argsCodeAndType = Array.mapWithIndex (\i p -> let ty = fromMaybe Any (Array.index argTypes i) in Tuple ty (sanitizeIdent p <> ".clone()")) deduped
                       
                       Tuple actualRetTy callCode = buildCallBindingGroupAt renames valueEnums globalClassFields modNameStr argsCodeAndType fnTy fnCode 0
                   in boxUnbox renames valueEnums globalClassFields modNameStr retType actualRetTy callCode
            in { paramsCode: pCode, retCode: codegenExprTypeWithValueEnums valueEnums modNameStr true retType, bodyCode: bodyCodeRaw, isFunc: true }
          else 
            let isAbs = case innerExpr of
                  NeutralExpr (Abs _ _) -> true
                  _ -> false
            in if isAbs then
              let
                params = case innerExpr of
                  NeutralExpr (Abs p _) -> p
                  _ -> unsafeCrashWith "impossible"
                paramsArr = map (\(Tuple mbId _) -> case mbId of
                  Just (Ident n) -> n
                  _ -> "_") (NonEmptyArray.toArray params)
                deduped = dedupArgs paramsArr
                mbLoop = if isSelfRecursive then Just { name: identName, params: deduped, view: Nothing, tco: true } else Nothing
                argTys = extractAllArgTypes inferredType
                pCode = String.joinWith ", " $ Array.mapWithIndex (\i pName ->
                  let p = sanitizeIdent pName 
                      pt = fromMaybe Any (Array.index argTys i)
                      ptStr = codegenExprTypeWithValueEnums valueEnums modNameStr false pt
                  in (if p == "_" then "" else "mut ") <> p <> ": " <> ptStr) deduped
                retCode = codegenExprTypeWithValueEnums valueEnums modNameStr true (extractFinalRetType inferredType)
                bound = Map.empty
                body = case innerExpr of
                  NeutralExpr (Abs _ b) -> b
                  _ -> unsafeCrashWith "impossible"
                genResult = genAbs renames valueEnums modNameStr allZeroArity reuseContext mbLoop mergedArities globalClassFields bound Set.empty deduped inferredType body
              in { paramsCode: pCode, retCode: retCode, bodyCode: genResult, isFunc: true }
            else
              let
                bodyCodeRaw = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext Nothing mergedArities globalClassFields Map.empty Set.empty false expr
                bodyType = inferTypeExpr modNameStr mergedArities globalClassFields Map.empty expr
              in
                { paramsCode: ""
                , retCode: codegenExprTypeWithValueEnums valueEnums modNameStr true inferredType
                , bodyCode: boxUnbox renames valueEnums globalClassFields modNameStr inferredType bodyType bodyCodeRaw
                , isFunc: false
                }
        
        bodyCodeWithLoop = if isSelfRecursive && isFunc then
            "    loop {\n" <>
            "        break " <> bodyCode <> ";\n" <>
            "    }"
          else bodyCode
          
        bodyCodeFinal = if not group.recursive && not isFunc && Set.member ident options.moduleValues
            && not (Set.member identName reuseContext.privateWorkers) then
          ModuleValues.memoizedBody options.threaded identName retCode bodyCodeWithLoop
          else bodyCodeWithLoop
      in
        (if isFunc && Set.member identName reuseContext.privateWorkers then "fn " else "pub fn ") <> identName <> "(" <> paramsCode <> ")" <> (if retCode == "" then "" else " -> " <> retCode) <> " {\n" <>
        "    // AST: " <> printAST expr <> "\n" <>
        bodyCodeFinal <> "\n" <>
        "}\n\n" <>
        -- Keep the executable entry alias while qualifying imported main values.
        (if rawIdentName == "main" then "pub use " <> identName <> " as main;\n\n" else "")
      ) group.bindings
    in { code: code, arities: mergedArities }



getTyPrefix :: forall a. String -> Qualified a -> String
getTyPrefix modNameStr (Qualified mbMod _) = case mbMod of
  Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
  Nothing -> String.replaceAll (Pattern ".") (Replacement "_") modNameStr <> "_"


-- A discarded callback argument needs no representation conversion. Its
-- incoming ABI is known at the call boundary even when optimization retained
-- an older parameter annotation on a constant function such as void's mapper.
alignDiscardedCallbackArgs :: ExprType -> ExprType -> NeutralExpr -> NeutralExpr
alignDiscardedCallbackArgs expected actual expr =
  let
    strip (NeutralExpr (Typed _ inner)) = strip inner
    strip (NeutralExpr (Syn.TypeApp inner _)) = strip inner
    strip other = other
    inner = strip expr
    align params body = case unwrapType expected, unwrapType actual of
      Func expectedArgs _, Func actualArgs result
        | Array.length expectedArgs == Array.length params
        , Array.length actualArgs == Array.length params ->
            let
              used = freeVariables body
              names = map (\(Tuple mbId level) -> case mbId of
                Just (Ident name) -> sanitizeIdent name
                Nothing -> "lvl_" <> show (unwrap level)) params
              args = Array.mapWithIndex (\i name ->
                if Set.member name used then fromMaybe Any (Array.index actualArgs i)
                else fromMaybe Any (Array.index expectedArgs i)) names
            in if args == actualArgs then expr else NeutralExpr (Typed (Func args result) inner)
      _, _ -> expr
  in case inner of
    NeutralExpr (Abs params body) -> align (NonEmptyArray.toArray params) body
    NeutralExpr (UncurriedAbs params body) -> align params body
    _ -> expr

-- A literal positive power of two divides like a low-bit mask.
literalPowerOfTwoMask :: NeutralExpr -> Maybe Int
literalPowerOfTwoMask expr = case stripCodegenWrappers expr of
  NeutralExpr (Lit (LitInt k)) -> go k 0
  _ -> Nothing
  where
  go n mask
    | n == 1 = Just mask
    | n <= 0 = Nothing
    | n `mod` 2 /= 0 = Nothing
    | otherwise = go (n `div` 2) (mask * 2 + 1)

-- A `Data.Function.Uncurried` FnN type is a boxed function value: one
-- `unwrap_funcN` reaches its native arity instead of one unwrap per argument.
uncurriedFnArity :: Array String -> Array ExprType -> Maybe Int
uncurriedFnArity fqn args = case fqn of
  [ "Data", "Function", "Uncurried", name ]
    | String.indexOf (Pattern "Fn") name == Just 0
    , Array.length args >= 2
    , Array.length args - 1 <= maxNativeFunctionArity -> Just (Array.length args - 1)
  _ -> Nothing

-- Collect the parameter names of a (possibly curried) lambda, with its
-- innermost body. Uncurried binder groups flatten the same way.
flattenLambda :: NeutralExpr -> Maybe (Tuple (Array String) NeutralExpr)
flattenLambda expr = case stripCodegenWrappers expr of
  NeutralExpr (Abs params inner) -> case flattenLambda inner of
    Just (Tuple names body) -> Just (Tuple (map paramName (NonEmptyArray.toArray params) <> names) body)
    Nothing -> Nothing
  NeutralExpr (UncurriedAbs params inner) -> case flattenLambda inner of
    Just (Tuple names body) -> Just (Tuple (map paramName params <> names) body)
    Nothing -> Nothing
  other -> Just (Tuple [] other)

paramName :: Tuple (Maybe Ident) Level -> String
paramName (Tuple mbId _) = case mbId of
  Just (Ident n) -> sanitizeIdent n
  Nothing -> ""

-- A self-recursive loop under tail-call compilation. `view` records a captured
-- `Array Int` that the body reads by index: the loop is then also generated
-- over a borrowed slice, so the runtime representation is dispatched once per
-- call instead of on every read.
type LoopContext =
  { name :: String
  , params :: Array String
  , view :: Maybe ArrayView
  -- False while rendering a tail-call argument or a let-bound value: those are
  -- evaluated before the jump, so they must not emit `continue`.
  , tco :: Boolean
  }

-- The same loop context with the tail-call rewrite disabled. Index reads still
-- see the borrowed array view.
argLoopContext :: Maybe LoopContext -> Maybe LoopContext
argLoopContext = map \loop -> loop { tco = false }

-- `arg` is the Rust parameter holding `&[i64]` for `source`.
type ArrayView = { source :: String, arg :: String }

-- Direct subexpressions, used by the conservative scans below. Unlisted
-- constructors have no expression children.
exprChildren :: NeutralExpr -> Array NeutralExpr
exprChildren (NeutralExpr expr) = case expr of
  Syn.TypeApp a _ -> [ a ]
  App fn args -> Array.cons fn (NonEmptyArray.toArray args)
  Abs _ body -> [ body ]
  UncurriedApp fn args -> Array.cons fn args
  UncurriedAbs _ body -> [ body ]
  UncurriedEffectApp fn args -> Array.cons fn args
  UncurriedEffectAbs _ body -> [ body ]
  Accessor base _ -> [ base ]
  Update base props -> Array.cons base (map (\(Prop _ v) -> v) props)
  CtorSaturated _ _ _ _ fields -> map (\(Tuple _ v) -> v) fields
  LetRec _ binds body -> Array.cons body (map (\(Tuple _ v) -> v) (NonEmptyArray.toArray binds))
  Let _ _ value body -> [ value, body ]
  EffectBind _ _ value body -> [ value, body ]
  EffectPure value -> [ value ]
  EffectDefer inner -> [ inner ]
  Branch branches def -> Array.snoc (Array.concatMap (\(Pair cond body) -> [ cond, body ]) (NonEmptyArray.toArray branches)) def
  PrimOp op -> case op of
    Op1 _ a -> [ a ]
    Op2 _ a b -> [ a, b ]
  PrimEffect operation -> Array.fromFoldable operation
  Typed _ inner -> [ inner ]
  Lit (LitArray values) -> values
  Lit (LitRecord props) -> map (\(Prop _ v) -> v) props
  _ -> []

-- Identifiers bound anywhere inside an expression. A view is rejected when the
-- loop body could shadow the captured array.
boundNames :: NeutralExpr -> Set.Set String
boundNames expr@(NeutralExpr syn) = ownBinders syn <> foldMap boundNames (exprChildren expr)
  where
  identName (Ident n) = sanitizeIdent n
  binderSet = Set.fromFoldable <<< Array.mapMaybe (\(Tuple mbId _) -> identName <$> mbId)
  ownBinders = case _ of
    Abs params _ -> binderSet (NonEmptyArray.toArray params)
    UncurriedAbs params _ -> binderSet params
    UncurriedEffectAbs params _ -> binderSet params
    Let mbId _ _ _ -> Set.fromFoldable (identName <$> mbId)
    LetRec _ binds _ -> Set.fromFoldable (map (\(Tuple ident _) -> identName ident) (NonEmptyArray.toArray binds))
    EffectBind mbId _ _ _ -> Set.fromFoldable (identName <$> mbId)
    _ -> Set.empty

-- Array operands of direct index reads, in no particular order.
indexReadArrays :: String -> NeutralExpr -> Array NeutralExpr
indexReadArrays currentMod = go
  where
  go expr@(NeutralExpr syn) = own syn <> foldMap go (exprChildren expr)
  own syn = case syn of
    UncurriedApp producer args -> case directCallName currentMod producer, args of
      Just "Data_Array_unsafeIndexImpl", [ xs, _ ] -> [ xs ]
      _, _ -> []
    PrimOp (Op2 OpArrayIndex xs _) -> [ xs ]
    Accessor xs (GetIndex _) -> [ xs ]
    _ -> []

-- A captured `Array Int` that the loop reads by index. The candidate stays
-- conservative: the body must not rebind the name, and the variable's declared
-- type must be exactly `Array Int`.
intViewCandidate :: String -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Array String -> NeutralExpr -> Maybe String
intViewCandidate currentMod aritiesMap globalClassFields bound capturedArr body =
  Array.findMap tryVar capturedArr
  where
  reads = indexReadArrays currentMod body
  shadowed = boundNames body
  isLocal name e = case stripCodegenWrappers e of
    NeutralExpr (Local (Just (Ident n)) _) -> sanitizeIdent n == name
    _ -> false
  tryVar name =
    if Set.member name shadowed then Nothing
    else case Array.find (isLocal name) reads of
      Nothing -> Nothing
      Just _ -> case Map.lookup name bound of
        Just ty | unwrapType ty == Array Int -> Just name
        _ -> Nothing

-- The borrowed slice backing a loop's captured `Array Int`, when an index read
-- targets exactly that variable.
viewSliceOf :: Maybe LoopContext -> NeutralExpr -> Maybe String
viewSliceOf mbLoop e = case mbLoop >>= _.view, stripCodegenWrappers e of
  Just view, NeutralExpr (Local (Just (Ident name)) _) | sanitizeIdent name == view.source -> Just view.arg
  _, _ -> Nothing

-- Variables only borrowed by an index read: the accessor takes `&self`, so
-- the receiver must not be cloned. Only a plain variable reference qualifies;
-- a computed receiver is a temporary with nothing to keep alive.
borrowedReadVars :: NeutralExpr -> Set.Set String
borrowedReadVars e = case stripCodegenWrappers e of
  NeutralExpr (Local _ _) -> freeVariables e
  _ -> Set.empty

-- Strip the erasure wrappers used to inspect a callee or producer expression.
stripCodegenWrappers :: NeutralExpr -> NeutralExpr
stripCodegenWrappers (NeutralExpr (Typed _ inner)) = stripCodegenWrappers inner
stripCodegenWrappers (NeutralExpr (Syn.TypeApp inner _)) = stripCodegenWrappers inner
stripCodegenWrappers e = e

-- Rust spelling of a direct global call target.
directCallName :: String -> NeutralExpr -> Maybe String
directCallName currentMod e = case stripCodegenWrappers e of
  NeutralExpr (Var q@(Qualified _ (Ident name))) -> Just (getTyPrefix currentMod q <> sanitizeIdent name)
  _ -> Nothing

-- Bounds of a direct rangeImpl application.
rangeApplication :: String -> NeutralExpr -> Maybe (Tuple NeutralExpr NeutralExpr)
rangeApplication currentMod e = case stripCodegenWrappers e of
  NeutralExpr (UncurriedApp producer args)
    | Just "Data_Array_rangeImpl" <- directCallName currentMod producer -> case args of
        [ startArg, endArg ] -> Just (Tuple startArg endArg)
        _ -> Nothing
  _ -> Nothing

-- A known foreign array helper applied to a statically known callback runs as
-- a monomorphic loop. The callback is emitted inside the caller's crate, so
-- neither the per-element dispatch nor the boxed accumulator survives, while
-- the array representation itself stays unchanged. A range producer stays
-- virtual, so a fused pipeline never materializes an intermediate array.
typedTraversalCall :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> Array NeutralExpr -> Array String -> NeutralExpr -> Maybe (Tuple ExprType String)
typedTraversalCall renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive argsArray argsCodeArray fn = case calleeName fn of
  Just callee -> case argsArray of
    [ cbArg, initArg, xsArg ] | callee == "Data_Foldable_foldlArray" -> foldTraversal "foldl" true cbArg initArg xsArg
    [ cbArg, initArg, xsArg ] | callee == "Data_Foldable_foldrArray" -> foldTraversal "foldr" false cbArg initArg xsArg
    [ predArg, xsArg ] | callee == "Data_Array_filterImpl" -> filterTraversal predArg xsArg
    [ predArg, xsArg ] | callee == "Data_Array_anyImpl" -> anyAllTraversal "any" predArg xsArg
    [ predArg, xsArg ] | callee == "Data_Array_allImpl" -> anyAllTraversal "all" predArg xsArg
    [ xsArg, idxArg ] | callee == "Data_Array_unsafeIndexImpl" -> unsafeIndexTraversal xsArg idxArg
    _ -> Nothing
  Nothing -> Nothing
  where
  infer ty = inferTypeExpr currentMod aritiesMap globalClassFields bound ty

  rustTy ty = codegenExprTypeWithValueEnums valueEnums currentMod false ty

  primitiveTy ty = case rustTy ty of
    "i64" -> Just ty
    "f64" -> Just ty
    "bool" -> Just ty
    "char" -> Just ty
    _ -> Nothing

  -- A boxed Value is a valid callback representation too: the generic
  -- callbacks are compiled that way, so a virtual producer can be consumed
  -- without materializing it.
  representableTy ty = isJust (primitiveTy ty) || rustTy ty == "crate::UnknownType"

  stripExpr = stripCodegenWrappers
  calleeName = directCallName currentMod

  arrayElement ty = case unwrapType ty of
    Array el -> Just el
    _ -> Nothing

  -- The element type of an array argument: its own annotation when PBO kept
  -- one, otherwise the declared result of a producer call such as rangeImpl.
  arrayElementFromExpr expr = case arrayElement (infer expr) of
    Just el -> Just el
    Nothing -> case stripExpr expr of
      NeutralExpr (UncurriedApp producer _) -> do
        callee <- calleeName producer
        declared <- Map.lookup callee aritiesMap
        case unwrapType declared of
          ADT _ fqn args ->
            case Array.last fqn of
              Just fnName | String.indexOf (Pattern "Fn") fnName == Just 0 -> case Array.last args of
                Just retTy -> arrayElement retTy
                Nothing -> Nothing
              _ -> Nothing
          _ -> Nothing
      _ -> Nothing

  functionParts ty = case unwrapType ty of
    Func argTys retTy -> Just (Tuple argTys retTy)
    _ -> Nothing

  -- An erased callback signature still matches a concrete instantiation: the
  -- call's well-typedness fixes the element and accumulator types.
  matchesAny left right = left == right || left == Any || right == Any

  -- Emit the callback as a concrete Rust closure. A global native function is
  -- called directly once its declared signature matches the instantiated one;
  -- a capture-free lambda has its body emitted with the parameters bound.
  callableFor argTys retTy arg = case stripExpr arg of
    NeutralExpr (Var q@(Qualified _ (Ident name))) ->
      let fullName = getTyPrefix currentMod q <> sanitizeIdent name
          declared = Map.lookup fullName aritiesMap
          sameRust left right = rustTy left == rustTy right
      in case declared >>= functionParts of
        Just (Tuple declArgs declRet)
          | Array.length declArgs == Array.length argTys
          , Array.all identity (Array.zipWith sameRust declArgs argTys)
          , sameRust declRet retTy
          , Array.all representableTy argTys
          , representableTy retTy ->
              let names = Array.mapWithIndex (\i _ -> "__purust_cb_" <> show i) argTys
                  params = String.joinWith ", " (Array.zipWith (\n ty -> n <> ": " <> rustTy ty) names argTys)
                  callArgs = String.joinWith ", " names
              in Just ("move |" <> params <> "| " <> fullName <> "(" <> callArgs <> ")")
        _ -> Nothing
    NeutralExpr (Abs _ _) -> flattenLambda arg >>= \(Tuple names body) -> inlineLambda (map (\n -> if String.null n then "_" else n) names) body
    NeutralExpr (UncurriedAbs _ _) -> flattenLambda arg >>= \(Tuple names body) -> inlineLambda (map (\n -> if String.null n then "_" else n) names) body
    _ -> Nothing
    where
    inlineLambda names body =
      let bound' = Map.union (Map.fromFoldable (Array.zip names argTys)) bound
      in if Array.length names /= Array.length argTys
           then Nothing
           else if not (Array.all representableTy argTys) || not (representableTy retTy)
             then Nothing
             else
               let bodyVars = freeVariables body
                   paramsSet = Set.fromFoldable names
               in if not (Set.isEmpty (Set.difference bodyVars paramsSet)) then Nothing
                  else
                    let bodyCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound' alive false body
                        bodyTy = inferTypeExpr currentMod aritiesMap globalClassFields bound' body
                    in if bodyTy /= retTy then Nothing
                       else
                         let converted = boxUnbox renames valueEnums globalClassFields currentMod retTy bodyTy bodyCode
                             paramsCode = String.joinWith ", " (Array.zipWith (\n ty -> n <> ": " <> rustTy ty) names argTys)
                         in Just ("move |" <> paramsCode <> "| " <> converted)

  rangeArgs = rangeApplication currentMod

  -- Split a known associative integer operation so its reduction can use
  -- independent accumulators. The declared signature must be exactly Int.
  associativeFold arg = case stripExpr arg of
    NeutralExpr (Var q@(Qualified _ (Ident name))) ->
      let fullName = getTyPrefix currentMod q <> sanitizeIdent name
      in case Map.lookup fullName aritiesMap >>= functionParts of
        Just (Tuple [ a, b ] ret) | a == Int && b == Int && ret == Int ->
          case fullName of
            "Data_Semiring_intAdd" -> Just "sum"
            "Data_Semiring_intMul" -> Just "product"
            _ -> Nothing
        _ -> Nothing
    -- `\a b -> a + b` (either order, curried or not) is the same reduction.
    NeutralExpr (Abs _ _) ->
      let isLocal name e = case stripExpr e of
            NeutralExpr (Local (Just (Ident n)) _) -> sanitizeIdent n == name
            _ -> false
      in case flattenLambda arg of
        Just (Tuple [ p0, p1 ] body) | not (String.null p0) && not (String.null p1) ->
          let used = freeVariables body
              paramsOnly = Set.fromFoldable [ p0, p1 ]
          in if not (Set.isEmpty (Set.difference used paramsOnly))
               then Nothing
               else case stripExpr body of
                 NeutralExpr (PrimOp (Op2 op a b)) ->
                   let kind = case op of
                         OpIntNum OpAdd -> Just "sum"
                         OpIntNum OpMultiply -> Just "product"
                         _ -> Nothing
                   in if (isLocal p0 a && isLocal p1 b) || (isLocal p1 a && isLocal p0 b) then kind else Nothing
                 _ -> Nothing
        _ -> Nothing
    _ -> Nothing

  uncurriedAppArgs name expr = case stripExpr expr of
    NeutralExpr (UncurriedApp producer args) | Just name' <- calleeName producer, name' == name -> Just args
    _ -> Nothing

  filterApp expr = case uncurriedAppArgs "Data_Array_filterImpl" expr of
    Just [ predArg, innerXs ] -> Just (Tuple predArg innerXs)
    _ -> Nothing

  replicateApp expr = case uncurriedAppArgs "Data_Array_replicateImpl" expr of
    Just [ countArg, valueArg ] -> Just (Tuple countArg valueArg)
    _ -> Nothing

  -- A range producer (possibly filtered) can stay virtual: its bounds are
  -- evaluated in argument order and the consumers below iterate it directly.
  rangePipeline expr = case filterApp expr of
    Just (Tuple predArg innerXs) -> case rangeArgs innerXs of
      Just (Tuple startArg endArg) -> Just { startArg, endArg, pred: Just predArg }
      Nothing -> Nothing
    Nothing -> case rangeArgs expr of
      Just (Tuple startArg endArg) -> Just { startArg, endArg, pred: Nothing }
      Nothing -> Nothing

  argCodeFor later expr = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound (Set.union alive (freeVariables later)) false expr

  rangeCodes startArg endArg =
    let startCode = argCodeFor endArg startArg
        endCode = argCodeFor (NeutralExpr (Lit (LitInt 0))) endArg
    in Tuple startCode endCode

  foldTraversal helperName leftToRight cbArg initArg xsArg = do
    accTy <- primitiveTy (infer initArg)
    Tuple cbArgs cbRet <- functionParts (infer cbArg)
    if Array.length cbArgs /= 2 || not (matchesAny cbRet accTy)
      then Nothing
      else do
        let first = fromMaybe Any (Array.index cbArgs 0)
            second = fromMaybe Any (Array.index cbArgs 1)
            initCode = fromMaybe "" (Array.index argsCodeArray 1)

            -- A range producer (optionally filtered) stays virtual.
            rangeFold = case rangePipeline xsArg of
              Just pipeline | leftToRight && matchesAny first accTy && matchesAny second Int -> do
                let Tuple startCode endCode = rangeCodes pipeline.startArg pipeline.endArg
                case associativeFold cbArg, accTy == Int of
                  Just "sum", true -> case pipeline.pred of
                    Just predArg -> do
                      predC <- callableFor [ Int ] Boolean predArg
                      pure (Tuple accTy ("purust_core::typed::sum_filter_range(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ", " <> predC <> ")"))
                    Nothing ->
                      pure (Tuple accTy ("purust_core::typed::sum_range(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ")"))
                  Just "product", true -> case pipeline.pred of
                    Just predArg -> do
                      predC <- callableFor [ Int ] Boolean predArg
                      pure (Tuple accTy ("purust_core::typed::product_filter_range(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ", " <> predC <> ")"))
                    Nothing ->
                      pure (Tuple accTy ("purust_core::typed::product_range(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ")"))
                  _, _ -> do
                    foldC <- callableFor [ accTy, Int ] accTy cbArg
                    case pipeline.pred of
                      Just predArg -> do
                        predC <- callableFor [ Int ] Boolean predArg
                        pure (Tuple accTy ("purust_core::typed::foldl_filter_range::<i64, " <> rustTy accTy <> ", _, _>(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ", " <> predC <> ", " <> foldC <> ")"))
                      Nothing ->
                        pure (Tuple accTy ("purust_core::typed::foldl_range::<i64, " <> rustTy accTy <> ", _>(" <> startCode <> ", " <> endCode <> ", " <> initCode <> ", " <> foldC <> ")"))
              _ -> Nothing

            -- A replicated element folds without materializing the array.
            -- An erased element type keeps the boxed representation, which is
            -- exactly what the generic callback expects.
            replicatedFold = do
              Tuple countArg valueArg <- replicateApp xsArg
              if not (leftToRight && matchesAny first accTy)
                then Nothing
                else do
                  closure <- callableFor [ accTy, second ] accTy cbArg
                  let countCode = argCodeFor valueArg countArg
                      valueCode = argCodeFor (NeutralExpr (Lit (LitInt 0))) valueArg
                  pure (Tuple accTy ("purust_core::typed::foldl_replicate::<" <> rustTy second <> ", " <> rustTy accTy <> ", _>(" <> countCode <> ", " <> valueCode <> ", " <> initCode <> ", " <> closure <> ")"))

            -- A filtered array can also stay virtual: one loop tests the
            -- predicate and folds the retained elements.
            filteredFold = do
              Tuple predArg innerXs <- filterApp xsArg
              if not leftToRight then Nothing else do
                elTy <- arrayElementFromExpr innerXs
                _ <- primitiveTy elTy
                if not (matchesAny first accTy && matchesAny second elTy)
                  then Nothing
                  else do
                    let xsCode = argCodeFor (NeutralExpr (Lit (LitInt 0))) innerXs
                    predC <- callableFor [ elTy ] Boolean predArg
                    -- A known associative integer operation accumulates
                    -- without the per-element callback.
                    if isJust (associativeFold cbArg) && accTy == Int && elTy == Int
                      then do
                        let helper = if associativeFold cbArg == Just "product" then "product_filter_array" else "sum_filter_array"
                        pure (Tuple accTy ("purust_core::typed::" <> helper <> "(" <> xsCode <> ", " <> initCode <> ", " <> predC <> ")"))
                      else do
                        foldC <- callableFor [ accTy, elTy ] accTy cbArg
                        pure (Tuple accTy ("purust_core::typed::foldl_filter::<" <> rustTy elTy <> ", " <> rustTy accTy <> ", _, _>(" <> xsCode <> ", " <> initCode <> ", " <> predC <> ", " <> foldC <> ")"))

            arrayFold = do
              elTy <- arrayElementFromExpr xsArg
              _ <- primitiveTy elTy
              if not ((if leftToRight then matchesAny first accTy && matchesAny second elTy else matchesAny first elTy && matchesAny second accTy))
                then Nothing
                else do
                  let xsCode = fromMaybe "" (Array.index argsCodeArray 2)
                  -- A known associative integer operation accumulates
                  -- without the per-element callback.
                  if leftToRight && isJust (associativeFold cbArg) && accTy == Int && elTy == Int
                    then do
                      let helper = if associativeFold cbArg == Just "product" then "product_array" else "sum_array"
                      pure (Tuple accTy ("purust_core::typed::" <> helper <> "(" <> xsCode <> ", " <> initCode <> ")"))
                    else do
                      let ordered = if leftToRight then [ accTy, elTy ] else [ elTy, accTy ]
                      closure <- callableFor ordered accTy cbArg
                      let call = "purust_core::typed::" <> helperName <> "::<" <> rustTy elTy <> ", " <> rustTy accTy <> ", _>(" <> xsCode <> ", " <> initCode <> ", " <> closure <> ")"
                      pure (Tuple accTy call)
        case rangeFold of
          Just result -> Just result
          Nothing -> case replicatedFold of
            Just result -> Just result
            Nothing -> case filteredFold of
              Just result -> Just result
              Nothing -> arrayFold

  filterTraversal predArg xsArg = case rangePipeline xsArg of
    Just pipeline | isNothing pipeline.pred -> do
      predC <- callableFor [ Int ] Boolean predArg
      let Tuple startCode endCode = rangeCodes pipeline.startArg pipeline.endArg
      pure (Tuple (Array Int) ("purust_core::typed::filter_range::<i64, _>(" <> startCode <> ", " <> endCode <> ", " <> predC <> ")"))
    _ -> case replicateApp xsArg of
      Just (Tuple countArg valueArg) -> do
        -- An erased element type keeps the boxed representation, which is
        -- exactly what the generic predicate expects.
        let elTy = case arrayElementFromExpr xsArg of
              Just el | isJust (primitiveTy el) -> el
              _ -> Any
        closure <- callableFor [ elTy ] Boolean predArg
        let countCode = argCodeFor valueArg countArg
            valueCode = argCodeFor (NeutralExpr (Lit (LitInt 0))) valueArg
        pure (Tuple (Array elTy) ("purust_core::typed::filter_replicate::<" <> rustTy elTy <> ", _>(" <> countCode <> ", " <> valueCode <> ", " <> closure <> ")"))
      _ -> do
        elTy <- arrayElementFromExpr xsArg
        _ <- primitiveTy elTy
        closure <- callableFor [ elTy ] Boolean predArg
        let xsCode = fromMaybe "" (Array.index argsCodeArray 1)
            call = "purust_core::typed::filter::<" <> rustTy elTy <> ", _>(" <> xsCode <> ", " <> closure <> ")"
        pure (Tuple (Array elTy) call)

  -- An `Array Int` read copies the integer instead of the boxed element, and a
  -- loop view reads the borrowed slice directly.
  unsafeIndexTraversal xsArg idxArg = case viewSliceOf mbLoop xsArg of
    Just slice -> do
      let idxCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false idxArg
      pure (Tuple Any ("crate::mk_int(" <> slice <> "[(" <> idxCode <> ") as usize])"))
    Nothing ->
      if unwrapType (infer xsArg) == Array Int
        then do
          -- The accessor borrows the receiver: keep the variable alive without
          -- cloning the buffer reference on every read.
          let xsCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound (Set.difference alive (borrowedReadVars xsArg)) false xsArg
              idxCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false idxArg
          pure (Tuple Any ("crate::mk_int((" <> xsCode <> ").array_get_int((" <> idxCode <> ") as usize))"))
        else Nothing

  -- Predicate scans over a known array or range stop at the first witness.
  anyAllTraversal helperName predArg xsArg = case rangePipeline xsArg of
    Just pipeline | isNothing pipeline.pred -> do
      predC <- callableFor [ Int ] Boolean predArg
      let Tuple startCode endCode = rangeCodes pipeline.startArg pipeline.endArg
      pure (Tuple Boolean ("purust_core::typed::" <> helperName <> "_range::<i64, _>(" <> startCode <> ", " <> endCode <> ", " <> predC <> ")"))
    _ -> do
      elTy <- arrayElementFromExpr xsArg
      _ <- primitiveTy elTy
      predC <- callableFor [ elTy ] Boolean predArg
      let xsCode = fromMaybe "" (Array.index argsCodeArray 1)
      pure (Tuple Boolean ("purust_core::typed::" <> helperName <> "_array::<" <> rustTy elTy <> ", _>(" <> xsCode <> ", " <> predC <> ")"))

genApp :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> ExprType -> NeutralExpr -> Array NeutralExpr -> String
genApp renames valueEnums modNameStr allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive appTy fn originalArgs =
    let
        expectedArgs = extractAllArgTypes (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn)
        argsArray = Array.mapWithIndex (\i arg ->
          let expectedTy = fromMaybe Any (Array.index expectedArgs i)
              alignClassLiteral expr = case expr of
                NeutralExpr (Typed _ inner) -> alignClassLiteral inner
                NeutralExpr (Lit (LitRecord _)) -> case unwrapType expectedTy of
                  ADT _ fqn _ | Map.member (String.joinWith "_" fqn) globalClassFields -> NeutralExpr (Typed expectedTy expr)
                  _ -> arg
                _ -> arg
              aligned = alignClassLiteral arg
          in alignDiscardedCallbackArgs expectedTy
            (inferTypeExpr modNameStr aritiesMap globalClassFields bound aligned) aligned) originalArgs
        buildCall :: ExprType -> String -> Int -> Tuple ExprType String
        buildCall accTy accCode idx = if idx >= Array.length argsCodeArray then Tuple accTy accCode else
            case unwrapType accTy of
              Func argTys retTy ->
                let arity = Array.length argTys
                in if arity > 0 && arity <= maxNativeFunctionArity then
                     let availableArgsCount = Array.length argsCodeArray - idx
                     in if availableArgsCount >= arity then
                          let passedArgs = Array.slice idx (idx + arity) argsCodeArray
                              passedArgsTys = Array.slice idx (idx + arity) argsArray
                              boxedArgs = Array.mapWithIndex (\i argCode -> 
                                  let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index passedArgsTys i)
                                      argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                                      expectedTy = fromMaybe Any (Array.index argTys i)
                                  in boxUnbox renames valueEnums globalClassFields modNameStr expectedTy argTy argCode
                                ) passedArgs
                              nextCode = "(" <> accCode <> ")(" <> String.joinWith ", " boxedArgs <> ")"
                          in buildCall retTy nextCode (idx + arity)
                        else
                          let missingCount = arity - availableArgsCount
                              passedArgs = Array.slice idx (Array.length argsCodeArray) argsCodeArray
                              passedArgsTys = Array.slice idx (Array.length argsCodeArray) argsArray
                              boxedPassedArgs = Array.mapWithIndex (\i argCode -> 
                                  let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index passedArgsTys i)
                                      argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                                      expectedTy = fromMaybe Any (Array.index argTys i)
                                  in boxUnbox renames valueEnums globalClassFields modNameStr expectedTy argTy argCode
                                ) passedArgs
                              etaArgs = Array.mapWithIndex (\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
                              evalArgs = Array.mapWithIndex (\i _ -> "eval_arg_" <> show i) passedArgs
                              letArgsCode = Array.mapWithIndex (\i boxedArg -> "        let mut eval_arg_" <> show i <> " = " <> boxedArg <> ";\n") boxedPassedArgs
                              missingEtasTypes = Array.drop availableArgsCount argTys
                              innerArgs = evalArgs <> Array.mapWithIndex (\i eta -> eta <> ".clone()") etaArgs
                              innerCall = "_fn_ptr(" <> String.joinWith ", " innerArgs <> ")"
                              etaArgsDecl = String.joinWith ", " (Array.mapWithIndex (\i eta -> "mut " <> eta <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr false (fromMaybe Any (Array.index missingEtasTypes i))) etaArgs)
                              retTyStr = codegenExprTypeWithValueEnums valueEnums modNameStr true retTy
                              letFnCode = "        let mut _fn_eval = (" <> accCode <> ");\n"
                              clonesCode = "    let mut _fn_ptr = _fn_eval.clone();\n" <> String.joinWith "" (map (\arg -> "    let mut " <> arg <> " = " <> arg <> ".clone();\n") evalArgs)
                              closureCode = "purust_core::Func" <> show missingCount <> "::Shared(std::rc::Rc::new(move |" <> etaArgsDecl <> "| -> " <> retTyStr <> " {\n" <> clonesCode <> "    " <> innerCall <> "\n}))"
                              blockCode = "{\n" <> letFnCode <> String.joinWith "" letArgsCode <> "    " <> closureCode <> "\n}"
                          in Tuple (Func missingEtasTypes retTy) blockCode
                   else
                     let argCode = fromMaybe "" (Array.index argsCodeArray idx)
                         argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray idx)
                         argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                         boxedArg = boxUnbox renames valueEnums globalClassFields modNameStr Any argTy argCode
                     in buildCall Any ("(" <> accCode <> ").unwrap_func1()(" <> boxedArg <> ")") (idx + 1)
              ADT _ fqn typeArgs
                | Just fnArity <- uncurriedFnArity fqn typeArgs
                , Array.length argsCodeArray - idx >= fnArity ->
                    -- A Value::FuncN always stores Value parameters and a
                    -- Value result, so every argument is boxed and the call
                    -- yields a boxed value.
                    let passedArgs = Array.slice idx (idx + fnArity) argsCodeArray
                        passedArgsTys = Array.slice idx (idx + fnArity) argsArray
                        boxedArgs = Array.mapWithIndex (\i argCode ->
                            let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index passedArgsTys i)
                                argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                            in boxUnbox renames valueEnums globalClassFields modNameStr Any argTy argCode
                          ) passedArgs
                        nextCode = "(" <> accCode <> ").unwrap_func" <> show fnArity <> "()(" <> String.joinWith ", " boxedArgs <> ")"
                    in buildCall Any nextCode (idx + fnArity)
              _ ->
                let argCode = fromMaybe "" (Array.index argsCodeArray idx)
                    argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray idx)
                    argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                    boxedArg = boxUnbox renames valueEnums globalClassFields modNameStr Any argTy argCode
                in buildCall Any ("(" <> accCode <> ").unwrap_func1()(" <> boxedArg <> ")") (idx + 1)
        getInner :: NeutralExpr -> NeutralExpr
        getInner (NeutralExpr (Typed _ inner)) = getInner inner
        getInner (NeutralExpr (Syn.TypeApp inner _)) = getInner inner
        getInner e = e
        -- TAST retains the record -> native class type of a dictionary
        -- newtype constructor, even when PBO omits its private $Dict binding.
        -- Require the exact qualified class and constructor convention; a
        -- similarly named ordinary function must keep its normal call.
        dictionaryResult =
          let result = applicationResultType 1 (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn)
          in case getInner fn, unwrapType result of
            NeutralExpr (Var qualified@(Qualified _ (Ident name))), ADT _ fqn _
              | Just className <- Array.last fqn
              , name == className <> "$Dict"
              , getTyPrefix modNameStr qualified <> sanitizeIdent className == String.joinWith "_" fqn
              , Map.member (String.joinWith "_" fqn) globalClassFields
              , Array.length argsArray == 1 -> Just result
            _, _ -> Nothing
        argsFree = map freeVariables argsArray
        operandType operand = codegenExprTypeWithValueEnums valueEnums modNameStr false
          (inferTypeExpr modNameStr aritiesMap globalClassFields bound operand)
        borrowFn = case unwrapType (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn) of
          Func argTys _ ->
            let arity = Array.length argTys
            in arity > 0 && arity <= maxNativeFunctionArity && Array.length argsArray >= arity
              && String.indexOf (Pattern ("purust_core::Func" <> show arity <> "<")) (operandType fn) == Just 0
              && isUnconvertedLocal operandType fn
          _ -> false
        borrowedFnVars = if borrowFn then freeVariables fn else Set.empty
        -- Calling FuncN borrows its receiver. A partial application instead
        -- captures an owned value, so it keeps the normal clone/move path.
        aliveForFn = Set.difference (Set.union alive (Array.foldl Set.union Set.empty argsFree)) borrowedFnVars
        fnCode = codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForFn false fn
        -- Arguments of a returned function belong to a subsequent call.
        lookupArity fname = 
          let key = if fname == "main" then "main" else fname
          in case Map.lookup key aritiesMap of
            Just ty -> Array.length (extractAllArgTypes ty)
            Nothing -> 0
            
        argsCodeArray = Array.mapWithIndex (\i arg -> 
            let subsequentArgsFree = Array.drop (i + 1) argsFree
                -- An argument may itself pass or capture the callee. Keep its
                -- owned value alive for the duration of the receiver borrow.
                aliveForArg = Set.union borrowedFnVars (Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree))
            in codegenExpr_ renames valueEnums modNameStr allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForArg false arg
          ) argsArray
        tcoTemps params = Array.mapWithIndex (\i argCode ->
          let argTy = case Array.index argsArray i of
                Just arg -> inferTypeExpr modNameStr aritiesMap globalClassFields bound arg
                Nothing -> Any
              paramTy = case Array.index params i of
                Just name -> fromMaybe argTy (Map.lookup (sanitizeIdent name) bound)
                Nothing -> argTy
              converted = boxUnbox renames valueEnums globalClassFields modNameStr paramTy argTy argCode
          in "        let _tco_temp_" <> show i <> " = " <> converted <> ";\n"
          ) argsCodeArray
          
        m = Array.length argsArray
        

        
        typedCall = typedTraversalCall renames valueEnums modNameStr allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive argsArray argsCodeArray fn
        resultCode = case typedCall of
          Just (Tuple actualTy typedCode) -> boxUnbox renames valueEnums globalClassFields modNameStr appTy actualTy typedCode
          Nothing -> plainResult
        plainResult = 
            let mbFnName = case getInner fn of
                  NeutralExpr (Var (Qualified mbMod (Ident name))) ->
                    let prefix = case mbMod of
                          Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn
                          Nothing -> modNameStr
                    in Just (prefix <> "_" <> sanitizeIdent name)
                  NeutralExpr (Local (Just (Ident name)) _) -> Just (sanitizeIdent name)
                  _ -> Nothing
                isTco = case mbLoop, mbFnName of
                  Just { name: ln, params: lp, tco: true }, Just n -> n == ln && m == Array.length lp
                  _, _ -> false
            in case dictionaryResult, Array.head argsArray, Array.head argsCodeArray of
               Just result, Just argument, Just code ->
                 boxUnbox renames valueEnums globalClassFields modNameStr result
                   (inferTypeExpr modNameStr aritiesMap globalClassFields bound argument) code
               _, _, _ -> if isTco then
                 case mbLoop of
                   Just { name: ln, params: lp, tco: true } ->
                       let tempsCode = tcoTemps lp
                           assignsCode = Array.mapWithIndex (\i pName -> "        " <> sanitizeIdent pName <> " = _tco_temp_" <> show i <> ";\n") lp
                       in "{\n" <> String.joinWith "" tempsCode <> String.joinWith "" assignsCode <> "        continue;\n    }"
                   _ -> ""
               else case getInner fn of
                 NeutralExpr (Var (Qualified mbMod (Ident name))) -> 
                   let sName = sanitizeIdent name
                   in
                        let modPrefix = case mbMod of
                              Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
                              Nothing -> String.replaceAll (Pattern ".") (Replacement "_") modNameStr <> "_"
                            fullName = modPrefix <> sName
                        in if fullName == "Data_Eq_eqInt" && m == 2 then
                             "purust_core::mk_bool((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() == (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if fullName == "Data_Semiring_addInt" && m == 2 then
                             "purust_core::mk_int((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() + (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if fullName == "Data_Ring_subInt" && m == 2 then
                             "purust_core::mk_int((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() - (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if fullName == "Data_Semiring_mulInt" && m == 2 then
                             "purust_core::mk_int((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() * (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if fullName == "Data_Ord_lessThanInt" && m == 2 then
                             "purust_core::mk_bool((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() < (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if fullName == "Data_Ord_greaterThanInt" && m == 2 then
                             "purust_core::mk_bool((" <> fromMaybe "" (Array.index argsCodeArray 0) <> ").init_int.unwrap() > (" <> fromMaybe "" (Array.index argsCodeArray 1) <> ").init_int.unwrap())"
                           else if (case mbLoop of
                                 Just { name: ln, params: lp, tco: true } -> fullName == ln && m == Array.length lp
                                 _ -> false) then
                             case mbLoop of
                               Just { name: ln, params: lp, tco: true } ->
                                     let tempsCode = tcoTemps lp
                                         assignsCode = Array.mapWithIndex (\i pName -> "        " <> sanitizeIdent pName <> " = _tco_temp_" <> show i <> ";\n") lp
                                         _dbg = unsafePerformEffect (log ("GENERATED CONTINUE FOR: " <> ln))
                                     in (if _dbg == unit then "" else "") <> "{\n" <>
                                        String.joinWith "" tempsCode <>
                                        String.joinWith "" assignsCode <>
                                        "        continue;\n" <>
                                        "    }"
                               _ -> ""
                           else if Map.member (if fullName == "main" then "main" else fullName) aritiesMap then
                             -- Top-level function
                             let n = lookupArity fullName
                                 fnTy = fromMaybe Any (Map.lookup (if fullName == "main" then "main" else fullName) aritiesMap)
                                 expectedArgTys = extractAllArgTypes fnTy
                                 _ = if fullName == "Control_Monad_ST_Uncurried_runSTFn3" then Debug.trace ("genApp renames valueEnums runSTFn3 fnTy: " <> printType fnTy <> " expectedArgTys len: " <> show (Array.length expectedArgTys)) \_ -> unit else unit
                                 boxedArgs = Array.mapWithIndex (\i argCode -> 
                                    let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
                                        argTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound argExpr
                                        expectedTy = fromMaybe Any (Array.index expectedArgTys i)
                                        _ = if fullName == "Control_Monad_ST_Uncurried_runSTFn3" then Debug.trace ("genApp renames valueEnums runSTFn3 arg " <> show i <> ": expectedTy=" <> printType expectedTy <> ", argTy=" <> printType argTy) \_ -> unit else unit
                                    in boxUnbox renames valueEnums globalClassFields modNameStr expectedTy argTy argCode
                                 ) argsCodeArray
                             in if n > 0 then
                               if m == n then
                                 fullName <> "(" <> String.joinWith ", " boxedArgs <> ")"
                               else if m < n then
                                 let missingCount = n - m
                                     etaArgs = Array.mapWithIndex (\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
                                     evalArgs = Array.mapWithIndex (\i _ -> "eval_arg_" <> show i) argsCodeArray
                                     letArgsCode = Array.mapWithIndex (\i boxedArg -> "        let mut eval_arg_" <> show i <> " = " <> boxedArg <> ";\n") boxedArgs
                                     
                                     expectedArgTys = extractAllArgTypes fnTy
                                     missingEtasTypes = Array.drop m expectedArgTys
                                     retTy = extractFinalRetType fnTy

                                     innerArgs = evalArgs <> Array.mapWithIndex (\i eta -> eta <> ".clone()") etaArgs
                                     innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                                     
                                     etaArgsDecl = String.joinWith ", " (Array.mapWithIndex (\i eta -> "mut " <> eta <> ": " <> codegenExprTypeWithValueEnums valueEnums modNameStr false (fromMaybe Any (Array.index missingEtasTypes i))) etaArgs)
                                     retTyStr = codegenExprTypeWithValueEnums valueEnums modNameStr true retTy
                                     clonesCode = String.joinWith "" (map (\arg -> "    let mut " <> arg <> " = " <> arg <> ".clone();\n") evalArgs)
                                     closureCode = "purust_core::Func" <> show missingCount <> "::Shared(std::rc::Rc::new(move |" <> etaArgsDecl <> "| -> " <> retTyStr <> " {\n" <> clonesCode <> "    " <> innerCall <> "\n}))"
                                     
                                     blockCode = "{\n" <> String.joinWith "" letArgsCode <> "    " <> closureCode <> "\n}"
                                 in boxUnbox renames valueEnums globalClassFields modNameStr appTy (Func missingEtasTypes retTy) blockCode
                               else
                                 let firstNArgs = Array.take n boxedArgs
                                     baseCall = fullName <> "(" <> String.joinWith ", " firstNArgs <> ")"
                                     remainingTy = inferTypeExpr modNameStr aritiesMap globalClassFields bound (Array.foldl (\acc _ -> NeutralExpr (App acc (NonEmptyArray.singleton (NeutralExpr (Var (Qualified Nothing (Ident ""))))))) fn (Array.take n argsArray))
                             in case buildCall remainingTy baseCall n of Tuple actualTy callCode -> boxUnbox renames valueEnums globalClassFields modNameStr appTy actualTy callCode
                             else
                               case buildCall (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn) fnCode 0 of Tuple actualTy callCode -> boxUnbox renames valueEnums globalClassFields modNameStr appTy actualTy callCode
                           else
                             case buildCall (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn) fnCode 0 of Tuple actualTy callCode -> boxUnbox renames valueEnums globalClassFields modNameStr appTy actualTy callCode
                 _ -> 
                   case buildCall (inferTypeExpr modNameStr aritiesMap globalClassFields bound fn) fnCode 0 of Tuple actualTy callCode -> boxUnbox renames valueEnums globalClassFields modNameStr appTy actualTy callCode
                   
    in resultCode

genAbs :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> Array String -> ExprType -> NeutralExpr -> String
genAbs renames valueEnums = genAbsWithEffect renames false valueEnums

genEffectAbs :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> Array String -> ExprType -> NeutralExpr -> String
genEffectAbs renames valueEnums = genAbsWithEffect renames true valueEnums

genAbsWithEffect :: Map.Map String String -> Boolean -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> Array String -> ExprType -> NeutralExpr -> String
genAbsWithEffect renames executeEffect valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr fnTy body =
    let
      capturedVars = Set.difference (freeVariables body) (Set.fromFoldable paramsArr)
      expectedArgTys = extractAllArgTypes fnTy
      expectedRetTy = extractFinalRetType fnTy

      newBound = Array.foldr (\(Tuple i p) b -> 
          let pTy = fromMaybe Any (Array.index expectedArgTys i)
          in if p == "_" then b else Map.insert (sanitizeIdent p) pTy b
        ) bound (Array.mapWithIndex Tuple paramsArr)

      arity = Array.length paramsArr
      isFuncN = arity > 0 && arity <= maxNativeFunctionArity && arity == Array.length expectedArgTys
    in if isFuncN then
      let
        bodyTy = inferTypeExpr currentMod aritiesMap globalClassFields newBound body
        rawCode = unsafePerformEffect do
          oldCaptured <- Ref.read globalCaptured
          _ <- Ref.modify (Set.union capturedVars) globalCaptured
          let res = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields newBound capturedVars false body
          Ref.write oldCaptured globalCaptured
          pure res
        
        remainingArgs = Array.drop arity expectedArgTys
        innermostExpectedRetTy = if Array.length remainingArgs > 0 then Func remainingArgs expectedRetTy else expectedRetTy
        boxedBody = boxUnbox renames valueEnums globalClassFields currentMod innermostExpectedRetTy
          (if executeEffect then Any else bodyTy)
          (if executeEffect then "(" <> rawCode <> ").unwrap_func1()(purust_core::Value::Unit)" else rawCode)
        
        argsCodeArr = Array.mapWithIndex (\i p -> "mut _a" <> show i <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false (fromMaybe Any (Array.index expectedArgTys i))) paramsArr
        argsCode = String.joinWith ", " argsCodeArr
        
        processParam (Tuple i p) st =
            if p == "_" then
                { code: st.code <> "    drop(_a" <> show i <> ");\n", bound: st.bound }
            else if Set.member p st.bound then
                { code: st.code <> "    drop(_a" <> show i <> ");\n", bound: st.bound }
            else
                let newBound = Set.insert p st.bound
                in if Set.member p (freeVariables body) then
                    { code: "    let mut " <> sanitizeIdent p <> " = _a" <> show i <> ";\n" <> st.code, bound: newBound }
                else
                    { code: st.code <> "    drop(_a" <> show i <> ");\n", bound: newBound }
        
        letBindingsAndDrops = (Array.foldr processParam { code: "", bound: Set.empty } (Array.mapWithIndex Tuple paramsArr)).code
        
        retTyStr = codegenExprTypeWithValueEnums valueEnums currentMod true innermostExpectedRetTy
        
        toCloneOutside = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable (Set.intersection capturedVars alive))
        outsideClonesCode = String.joinWith "" (map (\v -> "    let mut " <> sanitizeIdent v <> " = " <> sanitizeIdent v <> ".clone();\n") toCloneOutside)
        
        realCapturedVars = Set.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) capturedVars
        
        closureCode = if Set.isEmpty realCapturedVars then
            "purust_core::Func" <> show arity <> "::Static(|" <> argsCode <> "| -> " <> retTyStr <> " {\n" <> letBindingsAndDrops <> "    " <> boxedBody <> "\n} as fn(" <> String.joinWith ", " (map (\(Tuple i _) -> codegenExprTypeWithValueEnums valueEnums currentMod false (fromMaybe Any (Array.index expectedArgTys i))) (Array.mapWithIndex Tuple paramsArr)) <> ") -> " <> retTyStr <> ")"
          else
            "purust_core::Func" <> show arity <> "::Shared(std::rc::Rc::new(move |" <> argsCode <> "| -> " <> retTyStr <> " {\n" <> letBindingsAndDrops <> "    " <> boxedBody <> "\n}))"
            
      in if Array.length toCloneOutside > 0 then
           "{\n" <> outsideClonesCode <> "    " <> closureCode <> "\n}"
         else closureCode
    else
      let
        initialState = { 
          freeVars: freeVariables body, 
          isInnermost: true, 
          code: 
            let bodyTy = inferTypeExpr currentMod aritiesMap globalClassFields newBound body
                rawCode = unsafePerformEffect do
                  oldCaptured <- Ref.read globalCaptured
                  _ <- Ref.modify (Set.union capturedVars) globalCaptured
                  let res = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields newBound capturedVars false body
                  Ref.write oldCaptured globalCaptured
                  pure res
                remainingArgs = Array.drop (Array.length paramsArr) expectedArgTys
                innermostExpectedRetTy = if Array.length remainingArgs > 0 then Func remainingArgs expectedRetTy else expectedRetTy
            in boxUnbox renames valueEnums globalClassFields currentMod innermostExpectedRetTy
                 (if executeEffect then Any else bodyTy)
                 (if executeEffect then "(" <> rawCode <> ").unwrap_func1()(purust_core::Value::Unit)" else rawCode)
        }
        
        finalState = Array.foldr (\(Tuple i p) st -> 
            let
               pTy = fromMaybe Any (Array.index expectedArgTys i)
               pCode = "mut _a0: " <> codegenExprTypeWithValueEnums valueEnums currentMod false pTy
               remainingArgTys = Array.drop (i + 1) expectedArgTys
               thisRetTy = if Array.length remainingArgTys > 0 then Func remainingArgTys expectedRetTy else expectedRetTy
               retTyStr = codegenExprTypeWithValueEnums valueEnums currentMod true thisRetTy
               
               neededByInner = st.freeVars
               pIsUsed = Set.member p neededByInner
               
               letBindingAndDrop = 
                   if p == "_" then "    drop(_a0);\n"
                   else if pIsUsed then "    let mut " <> sanitizeIdent p <> " = _a0;\n"
                   else "    drop(_a0);\n"
               thisClosureCaptures = Set.delete p neededByInner
               realThisClosureCaptures = Set.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) thisClosureCaptures
               toClone = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable thisClosureCaptures)
               clonesCode = String.joinWith "" (map (\v -> "    let mut " <> sanitizeIdent v <> " = " <> sanitizeIdent v <> ".clone();\n") toClone)
               
               newCode = if Set.isEmpty realThisClosureCaptures then
                   "purust_core::Func1::Static(|" <> pCode <> "| -> " <> retTyStr <> " {\n" <>
                   clonesCode <> letBindingAndDrop <> "    " <> st.code <> "\n" <>
                   "} as fn(" <> codegenExprTypeWithValueEnums valueEnums currentMod false pTy <> ") -> " <> retTyStr <> ")"
                 else
                   "purust_core::Func1::Shared(std::rc::Rc::new(move |" <> pCode <> "| -> " <> retTyStr <> " {\n" <>
                   clonesCode <> letBindingAndDrop <> "    " <> st.code <> "\n" <>
                   "}))"
            in { freeVars: thisClosureCaptures, isInnermost: false, code: newCode }
        ) initialState (Array.mapWithIndex Tuple paramsArr)
        
        toCloneOutside = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable (Set.intersection finalState.freeVars alive))
        outsideClonesCode = String.joinWith "" (map (\v -> "let mut " <> sanitizeIdent v <> " = " <> sanitizeIdent v <> ".clone();\n    ") toCloneOutside)
        wrappedCode = if Array.length toCloneOutside > 0 then
            "{\n    " <> outsideClonesCode <> finalState.code <> "\n}"
          else finalState.code
      in wrappedCode

codegenExpr :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> String
codegenExpr renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive expr =
  codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive false expr

-- Native ADT reads borrow their Rc receiver. Representation-changing wrappers
-- and non-locals still need the normal ownership path when evaluating the base.
isBorrowableLocal :: (NeutralExpr -> String) -> NeutralExpr -> Boolean
isBorrowableLocal operandType operand =
  String.indexOf (Pattern "std::rc::Rc<") (operandType operand) == Just 0 && isUnconvertedLocal operandType operand

isUnconvertedLocal :: (NeutralExpr -> String) -> NeutralExpr -> Boolean
isUnconvertedLocal operandType = go
  where
  representation = operandType
  go (NeutralExpr (Local _ _)) = true
  go wrapped@(NeutralExpr (Typed _ inner)) =
    if representation wrapped == representation inner then go inner else false
  go (NeutralExpr (Syn.TypeApp inner _)) = go inner
  go _ = false

-- Reuse only a native local projected by the constructor being rebuilt, after
-- its last use. Non-local bases and representation conversions keep allocating.
consumedConstructorSource :: (NeutralExpr -> String) -> String -> String -> Set String -> Array NeutralExpr -> Maybe String
consumedConstructorSource operandType resultType ctorName alive fields =
  Array.head (Array.mapMaybe source fields)
  where
  source (NeutralExpr (Typed _ inner)) = source inner
  source (NeutralExpr (Syn.TypeApp inner _)) = source inner
  source (NeutralExpr (Accessor base (GetCtorField _ _ _ (Ident projectedCtor) _ _)))
    | projectedCtor == ctorName
    , operandType base == resultType
    , isBorrowableLocal operandType base =
        Array.head (Array.filter (\name -> not (Set.member name alive))
          (Array.fromFoldable (freeVariables base)))
  source _ = Nothing

ownedFieldSources :: ValueEnums -> String -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set String -> Array NeutralExpr -> Array OwnedFields
ownedFieldSources valueEnums currentMod aritiesMap globalClassFields bound alive =
  fieldSources operandType localName (\key -> map extractAllArgTypes (Map.lookup key aritiesMap)) sanitizeIdent currentMod alive
  where
  operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
    (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
  localName operand = if isBorrowableLocal operandType operand
    then Array.head (Array.fromFoldable (freeVariables operand)) else Nothing

rewriteOwnedFields :: ValueEnums -> String -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> OwnedFields -> NeutralExpr -> Maybe NeutralExpr
rewriteOwnedFields valueEnums currentMod aritiesMap globalClassFields bound = rewriteFields operandType localName
  where
  operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
    (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
  localName operand = if isBorrowableLocal operandType operand
    then Array.head (Array.fromFoldable (freeVariables operand)) else Nothing

bindOwnedFields :: OwnedFields -> Map.Map String ExprType -> Map.Map String ExprType
bindOwnedFields fields bound = Array.foldl (\acc (Tuple name ty) -> Map.insert name ty acc)
  bound (Array.zip fields.names fields.types)

ownedFieldsPattern :: OwnedFields -> String
ownedFieldsPattern fields = fields.constructor <> "(" <> String.joinWith ", " (map ("mut " <> _) fields.names) <> ")"

copyScalarType :: ValueEnums -> String -> ExprType -> Boolean
copyScalarType enums current ty = case unwrapType ty of
  Int -> true
  Number -> true
  Boolean -> true
  Char -> true
  ADT _ fqn _ -> case Array.last fqn of
    Just name -> isValueEnum enums (if Array.length fqn < 2 then current else String.joinWith "_" (Array.dropEnd 1 fqn)) name
    Nothing -> false
  _ -> false

-- Syntax proves that the value has no payload or deferred computation. Native
-- representation checks exclude value enums and wrappers requiring conversion.
nullaryValue :: ValueEnums -> String -> Map String ExprType -> Map String (Array (Tuple String ExprType)) -> Map String ExprType -> NeutralExpr -> Maybe { key :: String, ty :: ExprType }
nullaryValue valueEnums currentMod aritiesMap globalClassFields bound expr = do
  key <- identify expr
  pure { key, ty: inferTypeExpr currentMod aritiesMap globalClassFields bound expr }
  where
  representation value = codegenExprTypeWithValueEnums valueEnums currentMod false
    (inferTypeExpr currentMod aritiesMap globalClassFields bound value)
  identify wrapped@(NeutralExpr (Typed _ inner))
    | representation wrapped == representation inner = identify inner
  identify (NeutralExpr (Syn.TypeApp inner _)) = identify inner
  identify value@(NeutralExpr (CtorSaturated _ _ _ (Ident ctor) fields))
    | Array.null fields
    , native <- representation value
    , String.indexOf (Pattern "std::rc::Rc<") native == Just 0 = Just (native <> "::" <> ctor)
  identify value@(NeutralExpr (CtorDef _ _ (Ident ctor) fields))
    | Array.null fields
    , native <- representation value
    , String.indexOf (Pattern "std::rc::Rc<") native == Just 0 = Just (native <> "::" <> ctor)
  identify _ = Nothing

-- Only a positive tag test on a borrowed native local establishes this fact.
-- Matching a nullary expression in the body also proves the payload is empty.
reuseTestedNullaries :: ValueEnums -> String -> Map String ExprType -> Map String (Array (Tuple String ExprType)) -> Map String ExprType -> NeutralExpr -> NeutralExpr -> NeutralExpr
reuseTestedNullaries valueEnums currentMod aritiesMap globalClassFields bound cond body =
  case tested cond of
    Just { key, value } -> reuseNullaries
      (nullaryValue valueEnums currentMod aritiesMap globalClassFields bound)
      representation key value body
    Nothing -> body
  where
  representation value = codegenExprTypeWithValueEnums valueEnums currentMod false
    (inferTypeExpr currentMod aritiesMap globalClassFields bound value)
  tested wrapped@(NeutralExpr (Typed _ inner))
    | representation wrapped == representation inner = tested inner
  tested (NeutralExpr (Syn.TypeApp inner _)) = tested inner
  tested (NeutralExpr (PrimOp (Op1 (OpIsTag (Qualified _ (Ident ctor))) value)))
    | isBorrowableLocal representation value = Just { key: representation value <> "::" <> ctor, value }
  tested _ = Nothing

-- A scope returns its body. Keep the surrounding TAST result type on that
-- return path when optimization leaves an obsolete annotation inside it;
-- annotating its bound values would instead change their independent types.
annotateScopedResult :: ExprType -> NeutralExpr -> NeutralExpr
annotateScopedResult ty expr@(NeutralExpr syn) = case syn of
  Let ident level value body -> NeutralExpr (Let ident level value (annotateScopedResult ty body))
  LetRec level bindings body -> NeutralExpr (LetRec level bindings (annotateScopedResult ty body))
  Typed _ inner -> annotateScopedResult ty inner
  Syn.TypeApp inner argument -> NeutralExpr (Syn.TypeApp (annotateScopedResult ty inner) argument)
  _ -> NeutralExpr (Typed ty expr)

codegenExpr_ :: Map.Map String String -> ValueEnums -> String -> Set.Set String -> ReuseContext -> Maybe LoopContext -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> Set.Set String -> Boolean -> NeutralExpr -> String
codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock expr@(NeutralExpr syn) =
  let
    borrowedRecordScalar :: ExprType -> NeutralExpr -> Maybe String
    borrowedRecordScalar expected value = do
      projection <- recordProjection
        (inferTypeExpr currentMod aritiesMap globalClassFields bound)
        (codegenExprTypeWithValueEnums valueEnums currentMod false)
        expected value
      -- These labels do not have runtime getters in codegenPrelude.
      if Array.any (\field -> Array.elem field [ "", "unwrap", "clone", "as_ref", "tag", "vals", "call" ]) projection.fields
        then Nothing
        else do
          name <- localName projection.root
          method <- case expected of
            Int -> Just "unwrap_int"
            Number -> Just "unwrap_number"
            Boolean -> Just "unwrap_bool"
            Char -> Just "unwrap_char"
            _ -> Nothing
          let path = "(&" <> name <> ")" <> Array.foldMap
                (\field -> ".__purust_borrow_" <> fieldBase renames field <> "()") projection.fields
          pure ("/* purust record: borrowed scalar */(" <> path <> ")." <> method <> "()")
      where
      localName (NeutralExpr (Typed _ inner)) = localName inner
      localName (NeutralExpr (Syn.TypeApp inner _)) = localName inner
      localName (NeutralExpr (Local mbId lvl)) = Just case mbId of
        Just (Ident name) -> sanitizeIdent name
        Nothing -> "lvl_" <> show (unwrap lvl)
      localName _ = Nothing

    scalarOperand expected value actual raw = fromMaybe
      (boxUnbox renames valueEnums globalClassFields currentMod expected actual raw)
      (borrowedRecordScalar expected value)

    isEffectNode :: NeutralExpr -> Boolean
    isEffectNode (NeutralExpr e) = case e of
      EffectBind _ _ _ _ -> true
      EffectPure _ -> true
      PrimEffect _ -> true
      UncurriedEffectApp _ _ -> true
      Let _ _ _ body -> isEffectNode body
      LetRec _ _ body -> isEffectNode body
      Typed _ inner -> isEffectNode inner
      EffectDefer inner -> isEffectNode inner
      _ -> false
  in
    if isEffectNode expr && not inEffectBlock then
      let
        freeVars = freeVariables expr
        toCloneOutside = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable (Set.intersection freeVars alive))
        outsideClonesCode = String.joinWith "" (map (\v -> "let mut " <> sanitizeIdent v <> " = " <> sanitizeIdent v <> ".clone();\n    ") toCloneOutside)
        toCloneInside = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable freeVars)
        insideClonesCode = "// FREEVARS: " <> String.joinWith ", " (Array.fromFoldable freeVars) <> "\n" <> String.joinWith "" (map (\v -> "    let mut " <> sanitizeIdent v <> " = " <> sanitizeIdent v <> ".clone();\n") toCloneInside)
        bodyCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound freeVars true expr
      in
        if Array.length toCloneInside == 0 then
          "{\n    " <> outsideClonesCode <> "purust_core::Value::Func1(purust_core::Func1::Static(|mut _u: crate::UnknownType| -> crate::UnknownType {\n" <>
          "        " <> bodyCode <> "\n" <>
          "    } as fn(crate::UnknownType) -> crate::UnknownType))\n}"
        else if Array.length toCloneOutside > 0 then
          "{\n    " <> outsideClonesCode <> "purust_core::Value::Func1(purust_core::Func1::Shared(std::rc::Rc::new(move |mut _u: crate::UnknownType| -> crate::UnknownType {\n" <>
          insideClonesCode <> "        " <> bodyCode <> "\n" <>
          "    })))\n}"
        else
          "{\n    purust_core::Value::Func1(purust_core::Func1::Shared(std::rc::Rc::new(move |mut _u: crate::UnknownType| -> crate::UnknownType {\n" <>
          insideClonesCode <> "        " <> bodyCode <> "\n" <>
          "    })))\n}"
    else case syn of
  Syn.TypeApp a ty ->
    codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock a

  Typed ty innerRaw -> 
    let 
      stripTyped :: NeutralExpr -> NeutralExpr
      stripTyped (NeutralExpr (Typed _ i)) = stripTyped i
      stripTyped other = other
      inner = stripTyped innerRaw
      -- An erased annotation can still surround a real abstraction. Keep its
      -- inferred function shape instead of extracting zero parameters from Any.
      effectiveTy = inferTypeExpr currentMod aritiesMap globalClassFields bound expr
    in if continuesLoop currentMod mbLoop inner then
      codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock inner
    else case inner of
      NeutralExpr PrimUndefined | unwrapType ty == Unit -> "()"
      NeutralExpr (Let _ _ _ _) | unwrapType ty /= Any ->
        codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock (annotateScopedResult ty inner)
      NeutralExpr (LetRec _ _ _) | unwrapType ty /= Any ->
        codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock (annotateScopedResult ty inner)
      NeutralExpr (Abs params body) ->
        let
          argTys = extractAllArgTypes effectiveTy
          n = Array.length argTys
          Tuple paramsArr innerBody = case extractAbsParams n innerRaw of
            Just (Tuple p b) -> Tuple p b
            Nothing -> 
              -- Fallback if we couldn't extract all expected params
              let p1 = map (\(Tuple mbId lvl) -> case mbId of
                         Just (Ident name) -> sanitizeIdent name
                         Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
              in Tuple p1 body
              
          actualTy = 
                let retTy = extractFinalRetType effectiveTy
                    filledArgTys = Array.mapWithIndex (\i _ -> fromMaybe Any (Array.index argTys i)) paramsArr
                    remainingArgTys = Array.drop (Array.length paramsArr) argTys
                    finalRetTy = if Array.length remainingArgTys > 0 then Func remainingArgTys retTy else retTy
                in Func filledArgTys finalRetTy
        in "/* Typed Abs */" <> boxUnbox renames valueEnums globalClassFields currentMod effectiveTy actualTy (genAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr actualTy innerBody)
      NeutralExpr (UncurriedAbs params body) ->
        let
          paramsArr = map (\(Tuple mbId lvl) -> case mbId of
            Just (Ident n) -> sanitizeIdent n
            Nothing -> "lvl_" <> show (unwrap lvl)) params
          actualTy = 
            let argTys = extractAllArgTypes effectiveTy
                retTy = extractFinalRetType effectiveTy
                filledArgTys = Array.mapWithIndex (\i _ -> fromMaybe Any (Array.index argTys i)) paramsArr
                remainingArgTys = Array.drop (Array.length paramsArr) argTys
                finalRetTy = if Array.length remainingArgTys > 0 then Func remainingArgTys retTy else retTy
            in Func filledArgTys finalRetTy
        in "/* Typed UncurriedAbs */" <> boxUnbox renames valueEnums globalClassFields currentMod effectiveTy actualTy (genAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr actualTy body)
      NeutralExpr (UncurriedEffectAbs params body) ->
        let
          paramsArr = map (\(Tuple mbId lvl) -> case mbId of
            Just (Ident n) -> sanitizeIdent n
            Nothing -> "lvl_" <> show (unwrap lvl)) params
          actualTy = 
            let argTys = extractAllArgTypes effectiveTy
                retTy = extractFinalRetType effectiveTy
                filledArgTys = Array.mapWithIndex (\i _ -> fromMaybe Any (Array.index argTys i)) paramsArr
                remainingArgTys = Array.drop (Array.length paramsArr) argTys
                finalRetTy = if Array.length remainingArgTys > 0 then Func remainingArgTys retTy else retTy
            in Func filledArgTys finalRetTy
        in "/* Typed UncurriedEffectAbs */" <> boxUnbox renames valueEnums globalClassFields currentMod effectiveTy actualTy (genEffectAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr actualTy body)
      NeutralExpr (Lit (LitRecord props)) ->
        case unwrapType ty of
          Unit | Array.null props -> "()"
          ADT _ fqnParts _
            | Array.length fqnParts >= 2
            , codegenExprTypeWithValueEnums valueEnums currentMod false ty /= "crate::UnknownType" ->
            let
              className = sanitizeIdent (fromMaybe "Unknown" (Array.last fqnParts))
              modName = String.joinWith "_" (Array.dropEnd 1 fqnParts)
              structName = if modName == currentMod then "crate::" <> className else "Purs_" <> modName <> "::" <> className
              propsArr = Array.fromFoldable props
              propsCode = Array.mapWithIndex (\i (Prop p val) ->
                let subsequentProps = Array.drop (i + 1) propsArr
                    aliveForProp = Set.union alive (Array.foldl (\acc (Prop _ sv) -> Set.union acc (freeVariables sv)) Set.empty subsequentProps)
                    valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound aliveForProp false val
                    valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
                    expectedTy = let findFieldTy k (ADT _ fqn _) =
                                       let modStr = String.joinWith "_" (Array.dropEnd 1 fqn)
                                           nameStr = fromMaybe "" (Array.last fqn)
                                           mbDecl = Map.lookup (modStr <> "_" <> nameStr) globalClassFields
                                       in case mbDecl of
                                            Just classFields -> case Array.find (\(Tuple fn _) -> fn == k) classFields of
                                              Just (Tuple _ t) -> t
                                              Nothing -> valTy
                                            Nothing -> valTy
                                     findFieldTy _ _ = valTy
                                 in findFieldTy p (unwrapType ty)
                 in recordFieldIdent renames p <> ": " <> boxUnbox renames valueEnums globalClassFields currentMod expectedTy valTy valCode
              ) propsArr
              fields = String.joinWith ", " propsCode
              -- `Foreign.Object` is a native map rather than a record shape, so
              -- a record literal coerced into it (`fromHomogeneous`) is built
              -- field by field.
              entriesCode = Array.mapWithIndex (\i (Prop p val) ->
                let subsequentProps = Array.drop (i + 1) propsArr
                    aliveForProp = Set.union alive (Array.foldl (\acc (Prop _ sv) -> Set.union acc (freeVariables sv)) Set.empty subsequentProps)
                    valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound aliveForProp false val
                    valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
                    boxed = boxUnbox renames valueEnums globalClassFields currentMod Any valTy valCode
                 in "(String::from(" <> show p <> "), " <> boxed <> ")"
              ) propsArr
            in if modName == "Foreign_Object" && className == "Object"
               then "std::rc::Rc::new(purust_core::SharedRecord::from_entries(vec![" <> String.joinWith ", " entriesCode <> "]))"
               else "std::rc::Rc::new(" <> structName <> " { " <> fields <> " })"
          _ ->
            let innerCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock inner
                innerTy = inferTypeExpr currentMod aritiesMap globalClassFields bound inner
            in "/* Typed " <> codegenExprTypeWithValueEnums valueEnums currentMod true ty <> " <- " <> codegenExprTypeWithValueEnums valueEnums currentMod true innerTy <> " : " <> printAST inner <> " */" <> boxUnbox renames valueEnums globalClassFields currentMod ty innerTy innerCode
      _ ->
        let innerCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock inner
            innerTy = inferTypeExpr currentMod aritiesMap globalClassFields bound inner
            fixedTy = inferTypeExpr currentMod aritiesMap globalClassFields bound (NeutralExpr (Typed ty inner))
        in fromMaybe
          ("/* Typed " <> codegenExprTypeWithValueEnums valueEnums currentMod true ty <> " <- " <> codegenExprTypeWithValueEnums valueEnums currentMod true innerTy <> " : " <> printAST inner <> " */" <> boxUnbox renames valueEnums globalClassFields currentMod fixedTy innerTy innerCode)
          (borrowedRecordScalar fixedTy expr)

  App fn args -> 
    let appTy = inferTypeExpr currentMod aritiesMap globalClassFields bound expr
        candidates = ownedFieldSources valueEnums currentMod aritiesMap globalClassFields bound alive (NonEmptyArray.toArray args)
        transfer fields = do
          rewritten <- rewriteOwnedFields valueEnums currentMod aritiesMap globalClassFields bound fields expr
          -- Calls move whole nodes only when every field is used. This avoids
          -- cloning unused payloads on the shared path.
          if Array.all (\name -> Set.member name (freeVariables rewritten)) fields.names
            then Just { fields, rewritten } else Nothing
    in case Array.head (Array.mapMaybe transfer candidates) of
      Just { fields, rewritten } ->
        let movedBound = bindOwnedFields fields bound
            fallback = "{ let " <> ownedFieldsPattern fields <> " = std::rc::Rc::unwrap_or_clone(" <> fields.source <> ") else { unreachable!() }; " <>
              codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields movedBound alive inEffectBlock rewritten <> " }"
            directName (NeutralExpr (Typed _ inner)) = directName inner
            directName (NeutralExpr (Syn.TypeApp inner _)) = directName inner
            directName (NeutralExpr (Var qualified@(Qualified _ (Ident name)))) = Just (Tuple qualified (getTyPrefix currentMod qualified <> sanitizeIdent name))
            directName _ = Nothing
            workerWithArgs movedArgs = do
              Tuple (Qualified mbMod (Ident name)) fullName <- directName fn
              fnType <- Map.lookup fullName aritiesMap
              if not (Set.member fullName reuseContext.workers)
                || Array.length (extractAllArgTypes fnType) /= Array.length movedArgs
                || codegenExprTypeWithValueEnums valueEnums currentMod false appTy /= "std::rc::Rc<" <> fields.nativeType <> ">"
                then Nothing else
                  let worker = NeutralExpr (Var (Qualified mbMod (Ident (sanitizeIdent name <> "__purust_reuse"))))
                      cell = NeutralExpr (Local (Just (Ident fields.source)) (Level (-1)))
                  in Just (genApp renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields movedBound alive appTy worker (Array.snoc movedArgs cell))
            workerCall = case rewritten of
              NeutralExpr (App _ movedArgs) -> workerWithArgs (NonEmptyArray.toArray movedArgs)
              _ -> Nothing
            typeRepresentation = codegenExprTypeWithValueEnums valueEnums currentMod false
            representation value = typeRepresentation
              (inferTypeExpr currentMod aritiesMap globalClassFields movedBound value)
            closedCall value = case stripCall value of
              NeutralExpr (App head callArgs) -> case directName head of
                Just (Tuple _ name) -> case Map.lookup name aritiesMap of
                  Just ty -> Set.member name reuseContext.closedCalls
                    && Array.length (extractAllArgTypes ty) == NonEmptyArray.length callArgs
                    && Array.all identity (Array.zipWith (\expected actual ->
                        typeRepresentation expected == representation actual)
                      (extractAllArgTypes ty) (NonEmptyArray.toArray callArgs))
                    && typeRepresentation (extractFinalRetType ty) == representation value
                  Nothing -> false
                Nothing -> false
              _ -> false
            stripCall value@(NeutralExpr syntax) = case syntax of
              Typed _ inner | representation value == representation inner -> stripCall inner
              Syn.TypeApp inner _ | representation value == representation inner -> stripCall inner
              _ -> value
            childPlan = do
              Tuple _ fullName <- directName fn
              cases <- Map.lookup fullName reuseContext.childCases
              guard (Set.member ("std::rc::Rc<" <> fields.nativeType <> ">") reuseContext.plainTrees)
              movedArgs <- case rewritten of
                NeutralExpr (App _ xs) -> Just (NonEmptyArray.toArray xs)
                _ -> Nothing
              Array.head (Array.mapMaybe (\branch -> do
                let qualified@(Qualified _ (Ident ctor)) = branch.constructor
                    ProperName typeName = branch.typeName
                helper <- Map.lookup (getTyPrefix currentMod qualified <> sanitizeIdent ctor) reuseContext.constructors
                guard (ctor == fields.constructorName && helper.typeName == typeName
                  && typeRepresentation helper.resultType == "std::rc::Rc<" <> fields.nativeType <> ">")
                update <- childUpdate typeRepresentation representation closedCall
                  (copyScalarType valueEnums currentMod) branch fields movedArgs
                guards <- traverse (\condition -> do
                  original <- Array.index (NonEmptyArray.toArray args) condition.parameter
                  let test = NeutralExpr (PrimOp (Op1 (OpIsTag condition.constructor) original))
                      code = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing
                        aritiesMap globalClassFields bound (Set.insert fields.source alive) false test
                  pure (if condition.matches then "(" <> code <> ")" else "!(" <> code <> ")")) branch.guards
                pure { update, guards }) cases)
            postChildPlan = do
              Tuple _ fullName <- directName fn
              post <- Map.lookup fullName reuseContext.postChildCases
              guard (Set.member ("std::rc::Rc<" <> fields.nativeType <> ">") reuseContext.plainTrees)
              movedArgs <- case rewritten of
                NeutralExpr (App _ xs) -> Just (NonEmptyArray.toArray xs)
                _ -> Nothing
              let qualified@(Qualified _ (Ident ctor)) = post.branch.constructor
                  ProperName typeName = post.branch.typeName
              helper <- Map.lookup (getTyPrefix currentMod qualified <> sanitizeIdent ctor) reuseContext.constructors
              guard (ctor == fields.constructorName && helper.typeName == typeName
                && typeRepresentation helper.resultType == "std::rc::Rc<" <> fields.nativeType <> ">")
              update <- childUpdate typeRepresentation representation closedCall
                (copyScalarType valueEnums currentMod) post.branch fields movedArgs
              -- The predicate and fallback both receive the computed child.
              -- Rebuild the argument permutation from fields, never from the
              -- original call expression, which would execute recursion twice.
              argumentFields <- traverse (\i -> Array.findIndex (_ == i) post.branch.fieldParams)
                (Array.mapWithIndex (\i _ -> i) movedArgs)
              computedArgs <- traverse (\i -> do
                name <- Array.index fields.names i
                ty <- Array.index fields.types i
                pure (NeutralExpr (Typed ty (NeutralExpr (Local (Just (Ident name)) (Level (-1))))))) argumentFields
              afterCall <- workerWithArgs computedArgs
              pure { update, name: post.name, permutation: post.permutation, argumentFields, afterCall }
            reuseCall call = "{ let mut " <> fields.source <> " = " <> fields.source <> "; " <>
              "let _taken = std::rc::Rc::get_mut(&mut " <> fields.source <> ").and_then(|node| node.__purust_take()); " <>
              "match _taken { std::option::Option::Some(" <> ownedFieldsPattern fields <> ") => " <> call <> ", " <>
              "std::option::Option::None => " <> fallback <> ", _ => unreachable!() } }"
        in case workerCall of
          Nothing -> fallback
          Just call ->
            let normal = reuseCall call
                postNormal = case postChildPlan of
                  Nothing -> normal
                  Just post ->
                    let replacement = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing
                          aritiesMap globalClassFields movedBound alive false post.update.replacement
                        reference i = "_purust_post_field_" <> show i
                        references = Array.mapWithIndex (\i _ -> reference i) fields.names
                        pattern = fields.constructor <> "(" <> String.joinWith ", " references <> ")"
                        copiedScalars = String.joinWith " " (Array.mapMaybe (\(Tuple i ty) ->
                          if copyScalarType valueEnums currentMod ty then
                            map (\name -> "let mut " <> name <> " = (*" <> reference i <> ").clone();") (Array.index fields.names i)
                          else Nothing) (Array.mapWithIndex Tuple fields.types))
                        childName = fromMaybe "_purust_post_child" (Array.index fields.names post.update.index)
                        predicate = post.name <> "(" <> String.joinWith ", " (map reference post.argumentFields) <> ")"
                        permutation = case post.permutation of
                          Just name -> " else if " <> name <> "(_purust_post_slot) { " <> fields.source <> " }"
                          Nothing -> ""
                    in "{ /* purust child call: post-call fields */ let mut " <> fields.source <> " = " <> fields.source <> "; " <>
                      "if let std::option::Option::Some(_purust_post_slot) = std::rc::Rc::get_mut(&mut " <> fields.source <> ") { " <>
                      "let " <> pattern <> " = _purust_post_slot else { unreachable!() }; " <> copiedScalars <> " " <>
                      "let mut " <> childName <> " = std::mem::replace(" <> reference post.update.index <> ", (*" <> reference post.update.sibling <> ").clone()); " <>
                      "let _purust_post_child = " <> replacement <> "; *" <> reference post.update.index <> " = _purust_post_child; " <>
                      "if " <> predicate <> " { " <> fields.source <> " }" <> permutation <> " else { " <>
                      "let std::option::Option::Some(" <> ownedFieldsPattern fields <> ") = _purust_post_slot.__purust_take() else { unreachable!() }; " <>
                      post.afterCall <> " } } else " <> normal <> " }"
            in case childPlan of
              Nothing -> postNormal
              Just { update, guards } ->
                let replacement = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing
                      aritiesMap globalClassFields movedBound alive false update.replacement
                    reference i = "_purust_child_field_" <> show i
                    references = Array.mapWithIndex (\i _ -> reference i) fields.names
                    pattern = fields.constructor <> "(" <> String.joinWith ", " references <> ")"
                    copiedScalars = String.joinWith " " (Array.mapMaybe (\(Tuple i ty) ->
                      if copyScalarType valueEnums currentMod ty then
                        map (\name -> "let mut " <> name <> " = (*" <> reference i <> ").clone();") (Array.index fields.names i)
                      else Nothing) (Array.mapWithIndex Tuple fields.types))
                    childName = fromMaybe "_purust_owned_child" (Array.index fields.names update.index)
                    fast = "{ /* purust child call: retained fields */ let mut " <> fields.source <> " = " <> fields.source <> "; " <>
                      "if let std::option::Option::Some(_purust_child_slot) = std::rc::Rc::get_mut(&mut " <> fields.source <> ") { " <>
                      "let " <> pattern <> " = _purust_child_slot else { unreachable!() }; " <> copiedScalars <> " " <>
                      "let mut " <> childName <> " = std::mem::replace(" <> reference update.index <> ", (*" <> reference update.sibling <> ").clone()); " <>
                      "let _purust_new_child = " <> replacement <> "; *" <> reference update.index <> " = _purust_new_child; " <>
                      fields.source <> " } else " <> normal <> " }"
                in if Array.null guards then fast else
                  "if " <> String.joinWith " && " guards <> " { " <> fast <> " } else { " <> postNormal <> " }"
      Nothing -> genApp renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive appTy fn (NonEmptyArray.toArray args)
  UncurriedApp fn args ->
    let appTy = inferTypeExpr currentMod aritiesMap globalClassFields bound (NeutralExpr (UncurriedApp fn args))
    in genApp renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive appTy fn args
  UncurriedEffectApp fn args -> 
    case fn of
      NeutralExpr (Typed _ (NeutralExpr (Accessor _ (GetProp "logRecord")))) -> 
        let arg0 = Array.head args
        in case arg0 of
             Just a0 -> "println!(\"{}\", " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false a0 <> ".a);"
             Nothing -> "// Unsupported UncurriedEffectApp without args\n"
      NeutralExpr (Accessor _ (GetProp "logRecord")) -> 
        let arg0 = Array.head args
        in case arg0 of
             Just a0 -> "println!(\"{}\", " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false a0 <> ".a);"
             Nothing -> "// Unsupported UncurriedEffectApp without args\n"
      NeutralExpr (Typed _ (NeutralExpr (Var (Qualified _ (Ident "logRecord"))))) -> 
        let arg0 = Array.head args
        in case arg0 of
             Just a0 -> "println!(\"{}\", " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false a0 <> ".a);"
             Nothing -> "// Unsupported UncurriedEffectApp without args\n"
      NeutralExpr (Var (Qualified _ (Ident "logRecord"))) -> 
        let arg0 = Array.head args
        in case arg0 of
             Just a0 -> "println!(\"{}\", " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false a0 <> ".a);"
             Nothing -> "// Unsupported UncurriedEffectApp without args\n"
      _ -> 
        let appTy = inferTypeExpr currentMod aritiesMap globalClassFields bound (NeutralExpr (UncurriedEffectApp fn args))
        in genApp renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive appTy fn args

  Update base props ->
    let
      propsArr = props
      baseVars = freeVariables base
      propVars = Array.foldl (\acc (Prop _ v) -> Set.union acc (freeVariables v)) Set.empty propsArr
      operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
        (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
      -- A local read has no evaluation to defer. Keep it alive while evaluating
      -- every RHS in order, then move it at last use. Retained aliases in those
      -- RHS values still make the ordinary setters take their copying path.
      moveAfterProps = case inferTypeExpr currentMod aritiesMap globalClassFields bound base of
        Record (Row _ Nothing) ->
          isUnconvertedLocal operandType base && operandType base == "crate::UnknownType"
            && Set.isEmpty (Set.intersection baseVars alive)
            && not (Set.isEmpty (Set.intersection baseVars propVars))
        _ -> false
      -- Flatten replacements in source order before detaching any level. The
      -- source root remains alive throughout, including inside opaque callbacks.
      plan = recordUpdate (inferTypeExpr currentMod aritiesMap globalClassFields bound base) operandType
        (\root -> isUnconvertedLocal operandType root && freeVariables root == baseVars) propsArr
      childName depth = "_record_child" <> if depth == 0 then "" else "_" <> show depth
      valueName depth i = (if depth == 0 then "_record" else childName (depth - 1)) <> "_update_" <> show i
      stagedValues depth (RecordUpdate replacements) = Array.concat (Array.mapWithIndex (\i (Prop _ replacement) ->
        case replacement of
          RecordValue value -> [Tuple (valueName depth i) value]
          RecordChild child -> stagedValues (depth + 1) child) replacements)
      staged = stagedValues 0 plan
      boxedValue aliveForValue v =
        let valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForValue false v
            valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound v
        in boxUnbox renames valueEnums globalClassFields currentMod Any valTy valCode
      propsCode = if moveAfterProps then Array.mapWithIndex (\i (Tuple name v) ->
        let laterVars = Array.foldl (\acc (Tuple _ sv) -> Set.union acc (freeVariables sv))
              (Set.union baseVars alive) (Array.drop (i + 1) staged)
        in "let " <> name <> " = " <> boxedValue laterVars v <> ";") staged
        else Array.mapWithIndex (\i (Prop k v) ->
          let laterVars = Array.foldl (\acc (Prop _ sv) -> Set.union acc (freeVariables sv)) alive (Array.drop (i + 1) propsArr)
          in "_base.set_" <> fieldBase renames k <> "(" <> boxedValue laterVars v <> ");") propsArr
      aliveForBase = if moveAfterProps then alive else Set.union alive propVars
      baseCode = "    let mut _base = " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForBase false base <> ";\n"
      valuesCode = "    " <> String.joinWith "\n    " propsCode <> "\n"
      -- One child per level makes depth-based temporary names unambiguous.
      -- Detach outside-in, restore inside-out; make_mut copies shared versions.
      setters depth parent (RecordUpdate replacements) = String.joinWith "\n    "
        (Array.mapWithIndex (\i (Prop k replacement) ->
          let setter = parent <> ".set_" <> fieldBase renames k
          in case replacement of
            RecordValue _ -> setter <> "(" <> valueName depth i <> ");"
            RecordChild child ->
              "let mut " <> childName depth <> " = " <> parent <> ".get_" <> fieldBase renames k <> "();\n    " <>
              setter <> "(purust_core::Value::Unit);\n    " <>
              setters (depth + 1) (childName depth) child <>
              "\n    " <> setter <> "(" <> childName depth <> ");") replacements)
    in
      "{\n" <>
      (if moveAfterProps then valuesCode <> baseCode <> "    " <> setters 0 "_base" plan <> "\n"
       else baseCode <> valuesCode) <>
      "    _base\n" <>
      "}"

  Branch branches def ->
    let
      branchesArr = map (\(Pair cond body) -> Pair cond
        (reuseTestedNullaries valueEnums currentMod aritiesMap globalClassFields bound cond body))
        (NonEmptyArray.toArray branches)
      branchTy = inferTypeExpr currentMod aritiesMap globalClassFields bound expr
      genBranchBody body =
        let raw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive false body
        in if continuesLoop currentMod mbLoop body then raw
           else boxUnbox renames valueEnums globalClassFields currentMod branchTy
             (inferTypeExpr currentMod aritiesMap globalClassFields bound body) raw
      branchCode = Array.mapWithIndex (\i (Pair cond body) -> 
        let 
            subsequentBranches = Array.drop (i + 1) branchesArr
            varsSubsequent = Array.foldl (\acc (Pair c b) -> Set.union acc (Set.union (freeVariables c) (freeVariables b))) (freeVariables def) subsequentBranches
            aliveForCond = Set.union alive (Set.union (freeVariables body) varsSubsequent)
            condCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForCond false cond
            condTy = inferTypeExpr currentMod aritiesMap globalClassFields bound cond
            condFinal = scalarOperand Boolean cond condTy condCode
        in "if " <> condFinal <> " {\n        " <> genBranchBody body <> "\n    }") branchesArr
      defCode = "{\n        " <> genBranchBody def <> "\n    }"
    in
      String.joinWith " else " branchCode <> " else " <> defCode
  PrimOp (Op1 op a) ->
    let aTy = inferTypeExpr currentMod aritiesMap globalClassFields bound a
        operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
          (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
        aliveForA = case op, unwrapType aTy of
          OpIsTag _, ADT _ _ _
            | isBorrowableLocal operandType a -> Set.difference alive (freeVariables a)
          _, _ -> alive
        aStrRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForA false a
        -- `length (filter p xs)` counts matches without building the array.
        filterCount = case stripCodegenWrappers a of
          NeutralExpr (UncurriedApp producer filterArgs)
            | Just "Data_Array_filterImpl" <- directCallName currentMod producer
            , [ predArg, innerXs ] <- filterArgs ->
                let
                  elementTy = case unwrapType (inferTypeExpr currentMod aritiesMap globalClassFields bound innerXs) of
                    Array el -> Just el
                    _ -> Nothing
                  predAt ty = case stripCodegenWrappers predArg of
                    NeutralExpr (Abs _ _) -> case flattenLambda predArg of
                      Just (Tuple [ name ] body) | not (String.null name) ->
                        let bound' = Map.insert name ty bound
                            bodyCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound' alive false body
                            bodyTy = inferTypeExpr currentMod aritiesMap globalClassFields bound' body
                        in if bodyTy == Boolean
                             then Just ("move |" <> name <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false ty <> "| " <> boxUnbox renames valueEnums globalClassFields currentMod Boolean bodyTy bodyCode)
                             else Nothing
                      _ -> Nothing
                    _ -> Nothing
                in case rangeApplication currentMod innerXs of
                  Just (Tuple startArg endArg) -> case predAt Int of
                    Just predC ->
                      let startCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound (Set.union alive (freeVariables endArg)) false startArg
                          endCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false endArg
                      in Just ("purust_core::typed::count_filter_range::<i64, _>(" <> startCode <> ", " <> endCode <> ", " <> predC <> ")")
                    Nothing -> Nothing
                  Nothing -> case elementTy of
                    Just elTy ->
                      let rustEl = codegenExprTypeWithValueEnums valueEnums currentMod false elTy
                          -- Only the primitive representations have a Repr impl;
                          -- anything else counts through the boxed Value.
                          representable = Array.elem rustEl [ "i64", "f64", "bool", "char", "crate::UnknownType" ]
                          argTy = if representable then elTy else Any
                          argRust = if representable then rustEl else "crate::UnknownType"
                      in case predAt argTy of
                        Just predC ->
                          let xsCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false innerXs
                          in Just ("purust_core::typed::count_filter_array::<" <> argRust <> ", _>(" <> xsCode <> ", " <> predC <> ")")
                        Nothing -> Nothing
                    Nothing -> Nothing
          _ -> Nothing
    in case op of
      OpBooleanNot -> "!(" <> scalarOperand Boolean a aTy aStrRaw <> " /* aTy: " <> codegenExprTypeWithValueEnums valueEnums currentMod true aTy <> ", a is " <> printAST a <> ", fn ty is " <> (case a of
        NeutralExpr (App fn _) -> printType (inferTypeExpr currentMod aritiesMap globalClassFields bound fn) <> ", lvl_3 in bound: " <> (case Map.lookup "lvl_3" bound of
          Just t -> printType t
          Nothing -> "none") <> ", lvl_3 in arities: " <> (case Map.lookup "lvl_3" aritiesMap of
          Just t -> printType t
          Nothing -> "none")
        _ -> "not app") <> " */)"
      OpIntBitNot -> "!(" <> scalarOperand Int a aTy aStrRaw <> ")"
      OpIntNegate -> "-(" <> scalarOperand Int a aTy aStrRaw <> ")"
      OpNumberNegate -> "-(" <> scalarOperand Number a aTy aStrRaw <> ")"
      OpArrayLength -> case rangeApplication currentMod a of
        Just (Tuple startArg endArg) ->
          let startCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound (Set.union alive (freeVariables endArg)) false startArg
              endCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false endArg
          in "purust_core::typed::length_range(" <> startCode <> ", " <> endCode <> ")"
        Nothing -> case filterCount of
          Just code -> code
          Nothing -> case stripCodegenWrappers a of
            NeutralExpr (UncurriedApp producer args)
              | Just "Data_Array_replicateImpl" <- directCallName currentMod producer
              , [ countArg, valueArg ] <- args ->
                  let countCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound (Set.union alive (freeVariables valueArg)) false countArg
                      valueCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false valueArg
                  in "{ let _purust_replicated = " <> valueCode <> "; (" <> countCode <> ").max(0) }"
            _ -> "((" <> boxUnbox renames valueEnums globalClassFields currentMod Any aTy aStrRaw <> ").array_len() as i64)"
      OpIsTag (Qualified mbMod (Ident ctorName)) ->
        let ctorModule = case mbMod of
              Just (ModuleName name) -> String.replaceAll (Pattern ".") (Replacement "_") name
              Nothing -> currentMod
            -- An opaque FFI result still has the constructor's declared layout.
            tagTy = fromMaybe aTy (map extractFinalRetType
              (Map.lookup (ctorModule <> "_" <> sanitizeIdent ctorName) aritiesMap))
        in case unwrapType tagTy of
          ADT className fqn _ -> 
             let modName = String.replaceAll (Pattern ".") (Replacement "_") (String.joinWith "_" (Array.dropEnd 1 fqn))
                 actualClassName = fromMaybe className (Array.last fqn)
                 enumName = if modName == currentMod then "crate::" <> sanitizeIdent actualClassName else "Purs_" <> modName <> "::" <> sanitizeIdent actualClassName
                 cName = sanitizeIdent ctorName
                 prefixedKey = modName <> "_" <> cName
                 lookupRes = Map.lookup prefixedKey aritiesMap
                 hasArgs = case map unwrapType lookupRes of
                   Just (Func _ _) -> true
                   _ -> false
                 suffix = if hasArgs then "(..)" else ""
                 boxedA = boxUnbox renames valueEnums globalClassFields currentMod (ADT className fqn []) aTy aStrRaw
                 debugComment = "/* OpIsTag Debug: " <> prefixedKey <> " -> " <> (case lookupRes of
                   Just t -> printType t
                   Nothing -> "Nothing") <> " */ "
                 receiver = "(" <> boxedA <> ")" <> if isValueEnum valueEnums modName actualClassName then "" else ".as_ref()"
             in debugComment <> "matches!(" <> receiver <> ", " <> enumName <> "::" <> cName <> suffix <> ")"
          _ -> "(" <> boxUnbox renames valueEnums globalClassFields currentMod Any aTy aStrRaw <> ".__purust_ctor_tag() == \"" <> ctorName <> "\")"
      _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op1 */"
  PrimOp (Op2 op a b) ->
    let aliveForA = Set.union alive (freeVariables b)
        aTy = inferTypeExpr currentMod aritiesMap globalClassFields bound a
        bTy = inferTypeExpr currentMod aritiesMap globalClassFields bound b
        aStrRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForA false a
        -- The right operand of `&&`/`||` is the value of the whole expression
        -- when it is evaluated, so a tail-recursive call there is still a loop
        -- continuation. Everywhere else, an operand is not a tail position.
        bLoop = case op of
          OpBooleanAnd -> mbLoop
          OpBooleanOr -> mbLoop
          _ -> argLoopContext mbLoop
        bStrRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext bLoop aritiesMap globalClassFields bound alive false b
        aStrInt = scalarOperand Int a aTy aStrRaw
        bStrInt = scalarOperand Int b bTy bStrRaw
        aStrBool = scalarOperand Boolean a aTy aStrRaw
        bStrBool = scalarOperand Boolean b bTy bStrRaw
        aStrNum = scalarOperand Number a aTy aStrRaw
        bStrNum = scalarOperand Number b bTy bStrRaw
        aStrChar = scalarOperand Char a aTy aStrRaw
        bStrChar = scalarOperand Char b bTy bStrRaw
        aStrStr = boxUnbox renames valueEnums globalClassFields currentMod String aTy aStrRaw
        bStrStr = boxUnbox renames valueEnums globalClassFields currentMod String bTy bStrRaw
    in case op of
      OpIntNum OpAdd -> "(" <> aStrInt <> " + " <> bStrInt <> ")"
      OpIntNum OpSubtract -> "(" <> aStrInt <> " - " <> bStrInt <> ")"
      OpIntNum OpMultiply -> "(" <> aStrInt <> " * " <> bStrInt <> ")"
      OpIntNum OpDivide -> "(" <> aStrInt <> " / " <> bStrInt <> ")"
      OpIntNum OpMod -> case literalPowerOfTwoMask b of
        -- Euclidean remainder of a positive power of two is the low-bit mask,
        -- which keeps the surrounding loops vectorizable.
        Just mask -> "((" <> aStrInt <> ") & " <> show mask <> ")"
        Nothing -> "{ let _mod_l: i64 = " <> aStrInt <> "; let _mod_r: i64 = " <> bStrInt <> "; _mod_l.checked_rem_euclid(_mod_r).unwrap_or(0_i64) }"
      OpIntBitAnd -> "(" <> aStrInt <> " & " <> bStrInt <> ")"
      OpIntBitOr -> "(" <> aStrInt <> " | " <> bStrInt <> ")"
      OpIntBitXor -> "(" <> aStrInt <> " ^ " <> bStrInt <> ")"
      OpIntBitShiftLeft -> "(" <> aStrInt <> " << " <> bStrInt <> ")"
      OpIntBitShiftRight -> "(" <> aStrInt <> " >> " <> bStrInt <> ")"
      OpIntBitZeroFillShiftRight -> "((" <> aStrInt <> " as u64 >> " <> bStrInt <> " as u64) as i64)"
      OpIntOrd OpEq -> "(" <> aStrInt <> " == " <> bStrInt <> ")"
      OpIntOrd OpNotEq -> "(" <> aStrInt <> " != " <> bStrInt <> ")"
      OpIntOrd OpGt -> "(" <> aStrInt <> " > " <> bStrInt <> ")"
      OpIntOrd OpGte -> "(" <> aStrInt <> " >= " <> bStrInt <> ")"
      OpIntOrd OpLt -> "(" <> aStrInt <> " < " <> bStrInt <> ")"
      OpIntOrd OpLte -> "(" <> aStrInt <> " <= " <> bStrInt <> ")"
      OpNumberOrd OpEq -> "(" <> aStrNum <> " == " <> bStrNum <> ")"
      OpNumberOrd OpNotEq -> "(" <> aStrNum <> " != " <> bStrNum <> ")"
      OpNumberOrd OpGt -> "(" <> aStrNum <> " > " <> bStrNum <> ")"
      OpNumberOrd OpGte -> "(" <> aStrNum <> " >= " <> bStrNum <> ")"
      OpNumberOrd OpLt -> "(" <> aStrNum <> " < " <> bStrNum <> ")"
      OpNumberOrd OpLte -> "(" <> aStrNum <> " <= " <> bStrNum <> ")"
      OpStringOrd OpEq -> "(" <> aStrStr <> " == " <> bStrStr <> ")"
      OpStringOrd OpNotEq -> "(" <> aStrStr <> " != " <> bStrStr <> ")"
      OpStringOrd OpGt -> "(" <> aStrStr <> " > " <> bStrStr <> ")"
      OpStringOrd OpGte -> "(" <> aStrStr <> " >= " <> bStrStr <> ")"
      OpStringOrd OpLt -> "(" <> aStrStr <> " < " <> bStrStr <> ")"
      OpStringOrd OpLte -> "(" <> aStrStr <> " <= " <> bStrStr <> ")"
      OpCharOrd OpEq -> "(" <> aStrChar <> " == " <> bStrChar <> ")"
      OpCharOrd OpNotEq -> "(" <> aStrChar <> " != " <> bStrChar <> ")"
      OpCharOrd OpGt -> "(" <> aStrChar <> " > " <> bStrChar <> ")"
      OpCharOrd OpGte -> "(" <> aStrChar <> " >= " <> bStrChar <> ")"
      OpCharOrd OpLt -> "(" <> aStrChar <> " < " <> bStrChar <> ")"
      OpCharOrd OpLte -> "(" <> aStrChar <> " <= " <> bStrChar <> ")"
      OpBooleanOrd OpEq -> "(" <> aStrBool <> " == " <> bStrBool <> ")"
      OpBooleanOrd OpNotEq -> "(" <> aStrBool <> " != " <> bStrBool <> ")"
      OpBooleanOrd OpGt -> "(" <> aStrBool <> " > " <> bStrBool <> ")"
      OpBooleanOrd OpGte -> "(" <> aStrBool <> " >= " <> bStrBool <> ")"
      OpBooleanOrd OpLt -> "(" <> aStrBool <> " < " <> bStrBool <> ")"
      OpBooleanOrd OpLte -> "(" <> aStrBool <> " <= " <> bStrBool <> ")"
      OpBooleanAnd -> "(" <> aStrBool <> " && " <> bStrBool <> ")"
      OpBooleanOr -> "(" <> aStrBool <> " || " <> bStrBool <> ")"
      OpArrayIndex -> case viewSliceOf mbLoop a of
        Just slice -> "crate::mk_int(" <> slice <> "[(" <> bStrInt <> ") as usize])"
        Nothing ->
          let aStrRawBorrowed = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound (Set.difference aliveForA (borrowedReadVars a)) false a
              aStr = boxUnbox renames valueEnums globalClassFields currentMod Any aTy aStrRawBorrowed
              indexed = "(" <> aStr <> ").array_get((" <> bStrInt <> ") as usize)"
          in case unwrapType aTy of
            Array Int -> "crate::mk_int((" <> aStr <> ").array_get_int((" <> bStrInt <> ") as usize))"
            _ -> indexed
      OpNumberNum OpAdd -> "(" <> aStrNum <> " + " <> bStrNum <> ")"
      OpNumberNum OpSubtract -> "(" <> aStrNum <> " - " <> bStrNum <> ")"
      OpNumberNum OpMultiply -> "(" <> aStrNum <> " * " <> bStrNum <> ")"
      OpNumberNum OpDivide -> "(" <> aStrNum <> " / " <> bStrNum <> ")"
      -- EuclideanRing Number has a zero remainder, including in PBO's evaluator.
      OpNumberNum OpMod -> "{ let _ = " <> aStrNum <> "; let _ = " <> bStrNum <> "; 0.0_f64 }"
      OpStringAppend -> "format!(\"{}{}\", " <> aStrStr <> ", " <> bStrStr <> ")"
      _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */"
  Accessor base (GetIndex index) -> case viewSliceOf mbLoop base of
    Just slice -> "crate::mk_int(" <> slice <> "[" <> show index <> "])"
    Nothing ->
      let baseCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound (Set.difference alive (borrowedReadVars base)) false base
          baseTy = inferTypeExpr currentMod aritiesMap globalClassFields bound base
      in case unwrapType baseTy of
        Array Int -> "crate::mk_int((" <> boxUnbox renames valueEnums globalClassFields currentMod Any baseTy baseCode <> ").array_get_int(" <> show index <> "))"
        _ -> "(" <> boxUnbox renames valueEnums globalClassFields currentMod Any baseTy baseCode <> ").array_get(" <> show index <> ")"
  Accessor base (GetProp k) -> 
    let baseStr = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound alive false base
        baseTy = inferTypeExpr currentMod aritiesMap globalClassFields bound base
        -- Opaque ADTs lowered to Value use dynamic fields even when their
        -- TAST annotation is nominal. Both access and unboxing must agree.
        nativeFields = case unwrapType baseTy of
          ADT _ _ _ -> codegenExprTypeWithValueEnums valueEnums currentMod false baseTy /= "crate::UnknownType"
          _ -> false
        resultTy = inferTypeExpr currentMod aritiesMap globalClassFields bound (NeutralExpr syn)
        accCode = if nativeFields
          then "(" <> baseStr <> ")." <> recordFieldIdent renames k <> ".clone()"
          else "(" <> baseStr <> ").get_" <> fieldBase renames k <> "()"
        actualTy = if nativeFields then resultTy else Any
    in boxUnbox renames valueEnums globalClassFields currentMod resultTy actualTy accCode
  Accessor base (GetCtorField (Qualified mbMod _) _ (ProperName tyNameStr) (Ident ctorName) _ fieldIdx) ->
    let operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
          (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
        aliveForBase = if isBorrowableLocal operandType base
          then Set.difference alive (freeVariables base)
          else alive
        baseRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForBase false base
        baseTy = inferTypeExpr currentMod aritiesMap globalClassFields bound base
        modName = case mbMod of
          Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn
          Nothing -> currentMod
        enumName = if modName == currentMod then "crate::" <> sanitizeIdent tyNameStr else "Purs_" <> modName <> "::" <> sanitizeIdent tyNameStr
        cName = sanitizeIdent ctorName
        matchArgs = String.joinWith ", " (map (\i -> if i == fieldIdx then "ref f" else "_") (Array.range 0 fieldIdx)) <> (if fieldIdx >= 0 then ", .." else "")
        expectedBaseTy = ADT tyNameStr [modName, tyNameStr] []
        baseStr = boxUnbox renames valueEnums globalClassFields currentMod expectedBaseTy baseTy baseRaw
    -- Keep the temporary parent alive until its child is cloned. A match also
    -- avoids rustc's pathological type-checking cost for nested if-let reads.
    in "{ match (" <> baseStr <> ").as_ref() { " <> enumName <> "::" <> cName <> "(" <> matchArgs <> ") => f.clone(), _ => unreachable!() } }"
  Var (Qualified mbMod (Ident name)) ->
        let
          modPrefix = case mbMod of
            Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
            Nothing -> String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_"
          fullName = modPrefix <> sanitizeIdent name
          
          key = if fullName == "main" then "main" else fullName
          isTopLevel = true
          expectedArgsLength = case Map.lookup key aritiesMap of
            Just ty -> Array.length (extractAllArgTypes ty)
            Nothing -> 0

          varCode = if isTopLevel then
            if expectedArgsLength == 0 then
               fullName <> "()"
            else
               "purust_core::Func" <> show expectedArgsLength <> "::Static(" <> fullName <> ")"
          else
            fullName
            
          isAlive = Set.member fullName alive
        in if isAlive then varCode <> ".clone()" else varCode
  Let mbId lvl val body ->
    let
      name = case mbId of
        Just (Ident nameRaw) -> sanitizeIdent nameRaw
        Nothing -> "lvl_" <> show (unwrap lvl)
      bodyVars = freeVariables body
      aliveForVal = Set.union alive bodyVars
      valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext (argLoopContext mbLoop) aritiesMap globalClassFields bound aliveForVal false val
      valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
      newBound = Map.insert name valTy bound
      -- if name is not in bodyVars, it's dead immediately
      deadCode = if Set.member name bodyVars then "" else "    drop(" <> name <> ");\n"
      newMbLoop = case mbLoop of
        Just l | l.name == name -> Nothing
        _ -> mbLoop
      normal = "{\n" <>
        "    let mut " <> name <> " = " <> valCode <> ";\n" <>
        deadCode <>
        "    " <> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext newMbLoop aritiesMap globalClassFields newBound alive inEffectBlock body <> "\n" <>
        "}"
      helperFor qualified@(Qualified _ (Ident ctor)) (ProperName typeName) = do
        helper <- Map.lookup (getTyPrefix currentMod qualified <> ctor) reuseContext.constructors
        if helper.typeName == typeName then Just { name: helper.name, resultType: helper.resultType } else Nothing
      isBuilder qualified = Array.any (\helper -> helper.name == qualified) (Array.fromFoldable (Map.values reuseContext.constructors))
      representation = codegenExprTypeWithValueEnums valueEnums currentMod false
      candidates = ownedFieldSources valueEnums currentMod aritiesMap globalClassFields bound alive (projectionChain val)
      transfer fields = do
        rewritten <- rewriteOwnedFields valueEnums currentMod aritiesMap globalClassFields bound fields expr
        reused <- reuseNestedConstructor representation helperFor isBuilder ("std::rc::Rc<" <> fields.nativeType <> ">") fields.source rewritten
        pure { fields, reused }
    in case Array.head (Array.mapMaybe transfer candidates) of
      Nothing -> normal
      Just { fields, reused } ->
        "{ let mut " <> fields.source <> " = " <> fields.source <> "; " <>
        "let _taken = std::rc::Rc::get_mut(&mut " <> fields.source <> ").and_then(|node| node.__purust_take()); " <>
        "match _taken { std::option::Option::Some(" <> ownedFieldsPattern fields <> ") => " <>
        codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields (bindOwnedFields fields bound) alive inEffectBlock reused <>
        ", std::option::Option::None => " <>
        codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound (Set.insert fields.source alive) inEffectBlock expr <>
        ", _ => unreachable!() } }"

  PrimEffect operation ->
    let prefix = if currentMod == "Control_Monad_ST_Internal" then "crate::" else "Purs_Control_Monad_ST_Internal::"
        operand otherAlive value = boxUnbox renames valueEnums globalClassFields currentMod Any
          (inferTypeExpr currentMod aritiesMap globalClassFields bound value)
          (codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound otherAlive false value)
        call = case operation of
          EffectRefNew value -> "Control_Monad_ST_Internal_new(" <> operand alive value <> ")"
          EffectRefRead reference -> "Control_Monad_ST_Internal_read(" <> operand alive reference <> ")"
          EffectRefWrite reference value ->
            "Control_Monad_ST_Internal_write(" <> operand (Set.union alive (freeVariables reference)) value <> ", " <> operand alive reference <> ")"
    in "(" <> prefix <> call <> ").unwrap_func1()(purust_core::Value::Unit)"

  EffectBind mbIdent lvl val body ->
    let name = case mbIdent of
          Just (Ident n) -> sanitizeIdent n
          Nothing -> "lvl_" <> show (unwrap lvl)
        
        stripEffectDefer :: NeutralExpr -> NeutralExpr
        stripEffectDefer e@(NeutralExpr syn) = case syn of
          EffectDefer inner -> stripEffectDefer inner
          Abs _ inner -> stripEffectDefer inner
          UncurriedEffectAbs _ inner -> stripEffectDefer inner
          Let ident l v innerBody -> NeutralExpr (Let ident l v (stripEffectDefer innerBody))
          LetRec l bindings innerBody -> NeutralExpr (LetRec l bindings (stripEffectDefer innerBody))
          Typed ty inner -> NeutralExpr (Typed ty (stripEffectDefer inner))
          _ -> e
          
        realVal = stripEffectDefer val
        
        isUncurriedApp :: NeutralExpr -> Boolean
        isUncurriedApp (NeutralExpr syn) = case syn of
          EffectPure _ -> true
          UncurriedEffectApp _ _ -> true
          PrimEffect _ -> true
          EffectBind _ _ _ _ -> true
          Let _ _ _ innerBody -> isUncurriedApp innerBody
          LetRec _ _ innerBody -> isUncurriedApp innerBody
          Typed _ inner -> isUncurriedApp inner
          _ -> false
          
        aliveForVal = Set.union alive (freeVariables body)
        rawValCode = boxUnbox renames valueEnums globalClassFields currentMod Any (inferTypeExpr currentMod aritiesMap globalClassFields bound realVal)
          (codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForVal true realVal)
        
        valCode = if isUncurriedApp realVal then rawValCode else 
          "{\n" <>
          "        let _val_eval = " <> rawValCode <> ";\n" <>
          "        if let purust_core::Value::Func1(f) = &_val_eval {\n" <>
          "            f(purust_core::Value::Unit)\n" <>
          "        } else if let purust_core::Value::Record_a(r) = &_val_eval {\n" <>
          "            if r.call.is_some() {\n" <>
          "                r.call.clone().unwrap()(purust_core::Value::Unit)\n" <>
          "            } else {\n" <>
          "                _val_eval\n" <>
          "            }\n" <>
          "        } else {\n" <>
          "            _val_eval\n" <>
          "        }\n" <>
          "    }"
        
        bodyVars = freeVariables body
        deadCode = if Set.member name bodyVars then "" else "    drop(" <> name <> ");\n"
        valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
        boundTy = case unwrapType valTy of
          ADT _ _ [t] -> t
          _ -> Any
        newBound = Map.insert name boundTy bound
        newMbLoop = case mbLoop of
          Just l | l.name == name -> Nothing
          _ -> mbLoop
        rawBodyCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext newMbLoop aritiesMap globalClassFields newBound alive inEffectBlock body
        bodyCode = if isEffectNode body then rawBodyCode else
          "{\n" <>
          "        let _val_eval = " <> rawBodyCode <> ";\n" <>
          "        if let purust_core::Value::Func1(f) = &_val_eval {\n" <>
          "            f(purust_core::Value::Unit)\n" <>
          "        } else if let purust_core::Value::Record_a(r) = &_val_eval {\n" <>
          "            if r.call.is_some() {\n" <>
          "                r.call.clone().unwrap()(purust_core::Value::Unit)\n" <>
          "            } else {\n" <>
          "                _val_eval\n" <>
          "            }\n" <>
          "        } else {\n" <>
          "            _val_eval\n" <>
          "        }\n" <>
          "    }"
    in
    "{\n" <>
    "    let mut " <> name <> " = " <> boxUnbox renames valueEnums globalClassFields currentMod boundTy Any valCode <> ";\n" <>
    deadCode <>
    "    " <> bodyCode <> "\n" <>
    "}"
  EffectPure val ->
    -- An effect returns a boxed value, even when that value is itself a function.
    boxUnbox renames valueEnums globalClassFields currentMod Any (inferTypeExpr currentMod aritiesMap globalClassFields bound val)
      (codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound alive false val)
  Local mbId lvl -> 
    let name = case mbId of
          Just (Ident nameRaw) -> sanitizeIdent nameRaw
          Nothing -> "lvl_" <> show (unwrap lvl)
        t = case Map.lookup name bound of
          Just tVal -> tVal
          Nothing -> Any
        _ = if name == "sup" then Debug.trace ("LOCAL sup type is: " <> printType t) \_ -> unit else unit
    in if Set.member name alive then name <> ".clone()" else name
  Lit lit -> case lit of
    LitInt i -> show i
    LitNumber n
      -- Rust has no `Infinity`/`NaN` literals, and PureScript's Show instance
      -- loses the sign of negative zero.
      | n /= n -> "f64::NAN"
      | n == 1.0 / 0.0 -> "f64::INFINITY"
      | n == -(1.0 / 0.0) -> "f64::NEG_INFINITY"
      | n == 0.0 && 1.0 / n < 0.0 -> "-0.0"
      | otherwise -> show n
    LitString s -> rustStringLiteral s
    LitChar c -> rustCharLiteral c
    LitBoolean b -> if b then "true" else "false"
    LitArray arr -> 
      let arrCode = Array.mapWithIndex (\i a -> 
            let subsequent = Array.drop (i + 1) arr
                aliveForA = Set.union alive (Array.foldl Set.union Set.empty (map freeVariables subsequent))
                aCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForA false a
                aTy = inferTypeExpr currentMod aritiesMap globalClassFields bound a
            in boxUnbox renames valueEnums globalClassFields currentMod Any aTy aCode
          ) arr
      in "crate::mk_array(vec![" <> String.joinWith ", " arrCode <> "])"
    LitRecord props ->
      let arrProps = props
          structName = recordStructName renames (map (\(Prop k _) -> k) arrProps)
          fields = String.joinWith ", " (Array.mapWithIndex (\i (Prop k v) -> 
            let subsequent = Array.drop (i + 1) arrProps
                aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\(Prop _ sv) -> freeVariables sv) subsequent))
                vCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForV false v
                vTy = inferTypeExpr currentMod aritiesMap globalClassFields bound v
                vFinal = boxUnbox renames valueEnums globalClassFields currentMod Any vTy vCode
            in recordFieldIdent renames k <> ": Some(" <> vFinal <> ")"
          ) arrProps)
      in "purust_core::Value::" <> structName <> "(perceus_ptr::PerceusPtr::new(" <> structName <> " { " <> fields <> (if Array.length props > 0 then ", " else "") <> "..Default::default() }))"
  Abs params body -> 
    let
      paramsArr = map (\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
    in genAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr (Func (map (\_ -> Any) paramsArr) Any) body
  UncurriedAbs params body ->
    let
      paramsArr = map (\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) params
    in genAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr (Func (map (\_ -> Any) paramsArr) Any) body
  UncurriedEffectAbs params body ->
    let
      paramsArr = map (\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) params
    in genEffectAbs renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive paramsArr (Func (map (\_ -> Any) paramsArr) Any) body
  PrimUndefined -> "purust_core::Value::Record_a(perceus_ptr::PerceusPtr::new(crate::Record_a { ..Default::default() }))"
  CtorSaturated (Qualified mbMod _) _ (ProperName tyNameStr) (Ident ctorName) fields ->
    case shareNullaries (nullaryValue valueEnums currentMod aritiesMap globalClassFields bound)
      (Set.union alive (Set.union (freeVariables expr) (Set.fromFoldable (Map.keys bound)))) expr of
      Just shared -> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock shared
      Nothing ->
        let
          modPrefix = getTyPrefix currentMod (Qualified mbMod (Ident tyNameStr))
          structKey = modPrefix <> sanitizeIdent tyNameStr
        in case Map.lookup structKey globalClassFields of
          Just classFields ->
            let
              structName = case mbMod of
                Just (ModuleName mn) ->
                   let mnStr = String.replaceAll (Pattern ".") (Replacement "_") mn
                   in if mnStr == currentMod then "crate::" <> sanitizeIdent tyNameStr else "Purs_" <> mnStr <> "::" <> sanitizeIdent tyNameStr
                Nothing -> "crate::" <> sanitizeIdent tyNameStr
              structFieldsCode = String.joinWith ", " (Array.mapWithIndex (\i (Tuple _ val) ->
                let (Tuple fieldName expectedTy) = fromMaybe (Tuple ("field" <> show i) Any) (Array.index classFields i)
                    subsequent = Array.drop (i + 1) fields
                    aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\(Tuple _ sv) -> freeVariables sv) subsequent))
                    valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForV false val
                    valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
                    resCode = boxUnbox renames valueEnums globalClassFields currentMod expectedTy valTy valCode
                    _ = if structName == "Purs_Data_Show::Show" then Debug.trace ("SHOW CtorSaturated field=" <> fieldName <> " expectedTy=" <> codegenExprTypeWithValueEnums valueEnums currentMod true expectedTy <> " valTy=" <> codegenExprTypeWithValueEnums valueEnums currentMod true valTy <> " valCode=" <> valCode <> " resCode=" <> resCode) \_ -> unit else unit
                in recordFieldIdent renames fieldName <> ": " <> resCode
              ) fields)
            in "std::rc::Rc::new(" <> structName <> " { " <> structFieldsCode <> " })"
          Nothing ->
            let
               enumPrefix = case mbMod of
                 Just (ModuleName mn) ->
                    let mnStr = String.replaceAll (Pattern ".") (Replacement "_") mn
                    in if mnStr == currentMod then "crate::" else "Purs_" <> mnStr <> "::"
                 Nothing -> "crate::"
               enumName = sanitizeIdent tyNameStr
               ctorClean = sanitizeIdent ctorName
               operandType operand = codegenExprTypeWithValueEnums valueEnums currentMod false
                 (inferTypeExpr currentMod aritiesMap globalClassFields bound operand)
               source = consumedConstructorSource operandType
                 ("std::rc::Rc<" <> enumPrefix <> enumName <> ">") ctorName alive
                 (map (\(Tuple _ val) -> val) fields)
               values = map (\(Tuple _ val) -> val) fields
               candidates = ownedFieldSources valueEnums currentMod aritiesMap globalClassFields bound alive values
               transfer = do
                 name <- source
                 owned <- Array.find (\candidate -> candidate.source == name && candidate.constructor == enumPrefix <> enumName <> "::" <> ctorClean) candidates
                 rewritten <- traverse (rewriteOwnedFields valueEnums currentMod aritiesMap globalClassFields bound owned) values
                 pure { owned, rewritten }
               -- Evaluate every field before touching the old node. Keep the source
               -- alive even if a field stores it: get_mut then detects that alias.
               aliveForFields = case source of
                 Just name -> Set.insert name alive
                 Nothing -> alive

               renderFields fieldBound fieldAlive fieldValues = if Array.null fieldValues then "" else
                   "(" <> String.joinWith ", " (Array.mapWithIndex (\i val ->
                     let subsequent = Array.drop (i + 1) fieldValues
                         aliveForV = Set.union fieldAlive (Array.foldl Set.union Set.empty (map freeVariables subsequent))
                         valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields fieldBound aliveForV false val
                         valTy = inferTypeExpr currentMod aritiesMap globalClassFields fieldBound val
                         ctorFqn = (case mbMod of
                           Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
                           Nothing -> String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_") <> sanitizeIdent ctorName
                         expectedFieldTy = case Map.lookup ctorFqn aritiesMap of
                           Just ctorTy -> fromMaybe Any (Array.index (extractAllArgTypes ctorTy) i)
                           Nothing -> Any
                     in boxUnbox renames valueEnums globalClassFields currentMod expectedFieldTy valTy valCode
                   ) fieldValues) <> ")"
               ctorModule = case mbMod of
                 Just (ModuleName mn) -> mn
                 Nothing -> currentMod
               constructed = enumPrefix <> enumName <> "::" <> ctorClean <> renderFields bound aliveForFields values
               fallback = case source of
                 Nothing -> "std::rc::Rc::new(" <> constructed <> ")"
                 Just name ->
                   "{ let _rebuilt = " <> constructed <> "; let mut _reused = " <> name <> "; " <>
                   "if let std::option::Option::Some(_slot) = std::rc::Rc::get_mut(&mut _reused) { " <>
                   "*_slot = _rebuilt; _reused } else { std::rc::Rc::new(_rebuilt) } }"
            in if isValueEnum valueEnums ctorModule tyNameStr then constructed else case transfer of
                 Nothing -> fallback
                 Just { owned, rewritten } ->
                   let fieldBound = bindOwnedFields owned bound
                       representation value = codegenExprTypeWithValueEnums valueEnums currentMod false
                         (inferTypeExpr currentMod aritiesMap globalClassFields fieldBound value)
                       update = do
                         index <- scalarFieldUpdate valueEnums
                           (codegenExprTypeWithValueEnums valueEnums currentMod false) representation owned rewritten
                         value <- Array.index values index
                         pure { index, value }
                       rebuilt = enumPrefix <> enumName <> "::" <> ctorClean <>
                         renderFields fieldBound alive rewritten
                   in case update of
                     Just { index, value } ->
                       let valueCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing
                             aritiesMap globalClassFields bound aliveForFields false value
                           pattern = owned.constructor <> "(" <> String.joinWith ", "
                             (Array.mapWithIndex (\i _ -> if i == index then "_updated_field" else "_") owned.names) <> ")"
                       in "{ let _new_field = " <> valueCode <> "; let mut " <> owned.source <> " = " <> owned.source <> "; " <>
                          "if let std::option::Option::Some(" <> pattern <> ") = std::rc::Rc::get_mut(&mut " <> owned.source <> ") { " <>
                          "*_updated_field = _new_field; " <> owned.source <> " } else " <> fallback <> " }"
                     Nothing -> "{ let mut " <> owned.source <> " = " <> owned.source <> "; " <>
                      "let _taken = std::rc::Rc::get_mut(&mut " <> owned.source <> ").and_then(|node| node.__purust_take()); " <>
                      "match _taken { std::option::Option::Some(" <> ownedFieldsPattern owned <> ") => { let _rebuilt = " <> rebuilt <> "; " <>
                      "*std::rc::Rc::get_mut(&mut " <> owned.source <> ").unwrap() = _rebuilt; " <> owned.source <> " }, " <>
                      "std::option::Option::None => " <> fallback <> ", _ => unreachable!() } }"
  CtorDef _ (ProperName tyNameStr) (Ident ctorName) fields -> 
      let enumPrefix = if currentMod == tyNameStr then "crate::" else "Purs_" <> currentMod <> "::" 
          rustCtor = "crate::" <> sanitizeIdent tyNameStr <> "::" <> sanitizeIdent ctorName
          len = Array.length fields
          ctorTy = fromMaybe Any (Map.lookup (currentMod <> "_" <> sanitizeIdent ctorName) aritiesMap)
          argTys = extractAllArgTypes ctorTy
          retTy = extractFinalRetType ctorTy
          retTyStr = codegenExprTypeWithValueEnums valueEnums currentMod true retTy
          argNames = Array.mapWithIndex (\i _ -> "a" <> show i) fields
          argsCode = String.joinWith ", " (Array.mapWithIndex (\i a -> "mut " <> a <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false (fromMaybe Any (Array.index argTys i))) argNames)
          innerCall = "std::rc::Rc::new(" <> rustCtor <> "(" <> String.joinWith ", " (map (\a -> a <> ".clone()") argNames) <> "))"
      in if len == 0 then
           if isValueEnum valueEnums currentMod tyNameStr then rustCtor else "std::rc::Rc::new(" <> rustCtor <> ")"
         else if len <= maxNativeFunctionArity then "purust_core::Func" <> show len <> "::Static(|" <> argsCode <> "| -> " <> retTyStr <> " { " <> innerCall <> " } as fn(" <> String.joinWith ", " (map (\i -> codegenExprTypeWithValueEnums valueEnums currentMod false (fromMaybe Any (Array.index argTys i))) (Array.range 0 (len - 1))) <> ") -> " <> retTyStr <> ")"
         else "/* ERROR: Ctor with > 12 fields */ std::rc::Rc::new(" <> rustCtor <> ")"

  LetRec _ binds body ->
    let
      bindsArray = NonEmptyArray.toArray binds
      
      declCode = String.joinWith "\n    " (map (\(Tuple (Ident n) _) -> 
          "let mut " <> sanitizeIdent n <> " = purust_core::Value::Thunk(perceus_ptr::PerceusPtr::new(crate::Thunk { ..Default::default() }));"
        ) bindsArray)
      
      evalCode = String.joinWith "\n    " (Array.mapWithIndex (\i (Tuple (Ident n) val) -> 
          let clonesCode = String.joinWith "\n        " (map (\(Tuple (Ident cn) _) -> 
                  "let mut " <> sanitizeIdent cn <> " = " <> sanitizeIdent cn <> ".clone();"
                ) bindsArray)
              subsequentVals = Array.drop (i + 1) bindsArray
              varsSubsequent = Array.foldl (\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty subsequentVals
              bindsVarsForAlive = Array.foldl (\acc (Tuple (Ident bn) _) -> Set.insert (sanitizeIdent bn) acc) Set.empty bindsArray
              aliveForVal = Set.union alive (Set.union bindsVarsForAlive (Set.union (freeVariables body) varsSubsequent))
              
              valTy = inferTypeExpr currentMod aritiesMap globalClassFields bound val
              allArgTypes = extractAllArgTypes valTy
              retType = extractFinalRetType valTy
              extracted = extractAbsParams (Array.length allArgTypes) val
              isSelfRecursive = Set.member (sanitizeIdent n) (freeVariables val)
              isTCO = isSelfRecursive && (case extracted of
                Just _ -> true
                Nothing -> false)
                
          in if isTCO && Array.length allArgTypes > 0 then
               let paramsArr = case extracted of
                     Just (Tuple p _) -> p
                     Nothing -> []
                   dedupedParams = dedupArgs paramsArr
                   innerExpr = case extracted of
                     Just (Tuple _ inner) -> inner
                     Nothing -> val
                     
                   capturedSet = Set.difference (freeVariables val) (Set.fromFoldable dedupedParams)
                   capturedArr = Array.filter (\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable capturedSet)
                   
                   -- A captured Int array read by index: the loop is also
                   -- generated once over a borrowed slice of that buffer.
                   viewCandidate = intViewCandidate currentMod aritiesMap globalClassFields bound capturedArr innerExpr
                   viewContext = map (\source -> { source, arg: "__purust_view" }) viewCandidate

                   -- Inner function definition
                   fnName = sanitizeIdent n <> "_impl"
                   capturedArgs = map (\c -> "mut " <> sanitizeIdent c <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false (fromMaybe Any (Map.lookup c bound))) capturedArr
                   paramPairs = Array.zip dedupedParams allArgTypes
                   funcArgs = map (\(Tuple p ty) -> "mut " <> sanitizeIdent p <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false ty) paramPairs
                   allArgsCode = String.joinWith ", " (capturedArgs <> funcArgs)
                   
                   mbLoop = Just { name: sanitizeIdent n, params: dedupedParams, view: Nothing, tco: true }
                   viewLoop = Just { name: sanitizeIdent n, params: dedupedParams, view: viewContext, tco: true }
                   innerBound = Array.foldl (\b (Tuple p ty) -> Map.insert (sanitizeIdent p) ty b) bound paramPairs
                   bodyRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields innerBound (freeVariables innerExpr) false innerExpr
                   bodyTy = inferTypeExpr currentMod aritiesMap globalClassFields innerBound innerExpr
                   boxedBody = if continuesLoop currentMod mbLoop innerExpr then bodyRaw
                     else boxUnbox renames valueEnums globalClassFields currentMod retType bodyTy bodyRaw
                   
                   retTyStr = codegenExprTypeWithValueEnums valueEnums currentMod true retType
                   fnCode = "fn " <> fnName <> "(" <> allArgsCode <> ") -> " <> retTyStr <> " {\n        loop {\n            break " <> boxedBody <> ";\n        }\n    }"
                   -- The slice variant is only called when the capture is an
                   -- unboxed Int array, so its index reads need no dispatch.
                   viewFnCode = case viewCandidate of
                     Just _ ->
                       let viewBodyRaw = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext viewLoop aritiesMap globalClassFields innerBound (freeVariables innerExpr) false innerExpr
                           boxedViewBody = if continuesLoop currentMod viewLoop innerExpr then viewBodyRaw
                             else boxUnbox renames valueEnums globalClassFields currentMod retType (inferTypeExpr currentMod aritiesMap globalClassFields innerBound innerExpr) viewBodyRaw
                       in "fn " <> fnName <> "_view(__purust_view: &[i64], " <> allArgsCode <> ") -> " <> retTyStr <> " {\n        loop {\n            break " <> boxedViewBody <> ";\n        }\n    }"
                     Nothing -> ""
                   
                   -- Bridge closure
                   arity = Array.length paramPairs
                   bridgeCode = if arity > 0 && arity <= maxNativeFunctionArity then
                       let
                           argsDecl = String.joinWith ", " (map (\(Tuple p ty) -> "mut " <> sanitizeIdent p <> ": " <> codegenExprTypeWithValueEnums valueEnums currentMod false ty) paramPairs)
                           clones = String.joinWith "\n        " (map (\c -> "let mut " <> sanitizeIdent c <> " = " <> sanitizeIdent c <> ".clone();") capturedArr)
                           innerArgs = String.joinWith ", " (map sanitizeIdent capturedArr <> map sanitizeIdent dedupedParams)
                           innerCallGeneric = fnName <> "(" <> innerArgs <> ")"
                           innerCall = case viewCandidate of
                             Just source -> "if let std::option::Option::Some(__purust_items) = " <> sanitizeIdent source <> ".int_array_now() { " <> fnName <> "_view(__purust_items.as_slice(), " <> innerArgs <> ") } else { " <> innerCallGeneric <> " }"
                             Nothing -> innerCallGeneric
                       in if Array.length capturedArr == 0 then
                            "purust_core::Func" <> show arity <> "::Static(|" <> argsDecl <> "| -> " <> codegenExprTypeWithValueEnums valueEnums currentMod true retType <> " {\n        " <> innerCall <> "\n    } as fn(" <> String.joinWith ", " (map (\(Tuple _ ty) -> codegenExprTypeWithValueEnums valueEnums currentMod false ty) paramPairs) <> ") -> " <> codegenExprTypeWithValueEnums valueEnums currentMod true retType <> ")"
                          else
                            "purust_core::Func" <> show arity <> "::Shared(std::rc::Rc::new(move |" <> argsDecl <> "| -> " <> codegenExprTypeWithValueEnums valueEnums currentMod true retType <> " {\n        " <> clones <> "\n        " <> innerCall <> "\n    }))"
                     else "unimplemented!(\"LetRec arity > 12\")"
                     
                   finalBridgeCode = boxUnbox renames valueEnums globalClassFields currentMod Any valTy bridgeCode
                   capturedClones = String.joinWith "\n        " (map (\c -> "let mut " <> sanitizeIdent c <> " = " <> sanitizeIdent c <> ".clone();") capturedArr)
               in "let val_" <> sanitizeIdent n <> " = {\n        " <> clonesCode <> "\n        " <> capturedClones <> "\n        " <> fnCode <> "\n        " <> viewFnCode <> "\n        " <> finalBridgeCode <> "\n    };"
             else
               let valCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext Nothing aritiesMap globalClassFields bound aliveForVal false val
                   boxedValCode = boxUnbox renames valueEnums globalClassFields currentMod Any valTy valCode
               in "let val_" <> sanitizeIdent n <> " = {\n        " <> clonesCode <> "\n        " <> boxedValCode <> "\n    };"
        ) bindsArray)
        
      mutCode = String.joinWith "\n    " (map (\(Tuple (Ident n) _) -> 
          "if let purust_core::Value::Thunk(ref thunk) = " <> sanitizeIdent n <> " {\n" <>
          "    assert!(thunk.value.set(val_" <> sanitizeIdent n <> ").is_ok(), \"recursive value initialized twice\");\n" <>
          "} else { unreachable!() }"
        ) bindsArray)
        
      newMbLoop = case mbLoop of
        Just l | Array.any (\(Tuple (Ident n) _) -> sanitizeIdent n == l.name) bindsArray -> Nothing
        _ -> mbLoop
      bodyCode = codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext newMbLoop aritiesMap globalClassFields bound alive inEffectBlock body
    in "{\n    " <> declCode <> "\n    " <> evalCode <> "\n    " <> mutCode <> "\n    " <> bodyCode <> "\n}"

  EffectDefer inner -> codegenExpr_ renames valueEnums currentMod allZeroArity reuseContext mbLoop aritiesMap globalClassFields bound alive inEffectBlock inner
  Fail _ -> "unimplemented!() /* Unsupported Expr: Fail */"
  _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Expr: " <> printAST expr <> " */"

printAST :: NeutralExpr -> String
printAST (NeutralExpr expr) = case expr of
  Syn.TypeApp a _ -> "TypeApp(" <> printAST a <> ")"
  App fn _ -> "App(" <> printAST fn <> ")"
  Lit _ -> "Lit"
  Var _ -> "Var(...)"
  Let _ _ _ _ -> "Let(...)"
  Local _ _ -> "Local(...)"
  Abs _ inner -> "Abs(..., " <> printAST inner <> ")"
  Typed _ inner -> "Typed(" <> printAST inner <> ")"
  EffectBind _ _ _ _ -> "EffectBind"
  EffectPure _ -> "EffectPure"
  Update _ _ -> "Update"
  Accessor inner prop -> "Accessor(" <> printAST inner <> ")"
  UncurriedEffectApp fn _ -> "UncurriedEffectApp(" <> printAST fn <> ")"
  LetRec _ _ inner -> "LetRec(..., " <> printAST inner <> ")"
  Branch _ _ -> "Branch(...)"
  PrimOp _ -> "PrimOp(...)"
  UncurriedApp fn _ -> "UncurriedApp(" <> printAST fn <> ")"
  CtorSaturated _ _ _ _ _ -> "CtorSaturated(...)"
  UncurriedAbs _ inner -> "UncurriedAbs(..., " <> printAST inner <> ")"
  UncurriedEffectAbs _ inner -> "UncurriedEffectAbs(..., " <> printAST inner <> ")"
  CtorDef _ _ _ _ -> "CtorDef"
  EffectDefer inner -> "EffectDefer(" <> printAST inner <> ")"
  PrimEffect _ -> "PrimEffect(...)"
  PrimUndefined -> "PrimUndefined"
  Fail msg -> "Fail(" <> msg <> ")"

freeVariables :: NeutralExpr -> Set String
freeVariables (NeutralExpr expr) = case expr of
  Syn.TypeApp a _ -> freeVariables a
  -- Globals do not participate in lexical liveness or closure captures.
  Var _ -> Set.empty
  Local mbId lvl -> Set.singleton (case mbId of
      Just (Ident nameRaw) -> sanitizeIdent nameRaw
      Nothing -> "lvl_" <> show (unwrap lvl))
  App fn args -> 
    Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) (NonEmptyArray.toArray args)
  Let mbId lvl val body ->
    let name = case mbId of
          Just (Ident i) -> sanitizeIdent i
          Nothing -> "lvl_" <> show (unwrap lvl)
    in Set.union (freeVariables val) (Set.delete name (freeVariables body))
  Typed _ inner -> freeVariables inner
  Update base props ->
    Array.foldl (\acc (Prop _ v) -> Set.union acc (freeVariables v)) (freeVariables base) props
  Branch branches def ->
    let branchVars = Array.foldl (\acc (Pair cond body) -> Set.union acc (Set.union (freeVariables cond) (freeVariables body))) Set.empty (NonEmptyArray.toArray branches)
    in Set.union branchVars (freeVariables def)
  PrimOp (Op1 _ a) -> freeVariables a
  PrimOp (Op2 _ a b) -> Set.union (freeVariables a) (freeVariables b)
  PrimEffect operation -> foldMap freeVariables operation
  Accessor base _ -> freeVariables base
  EffectBind mbIdent lvl val body ->
    let name = case mbIdent of
          Just (Ident i) -> sanitizeIdent i
          Nothing -> "lvl_" <> show (unwrap lvl)
        bodyVars = Set.delete name (freeVariables body)
    in Set.union (freeVariables val) bodyVars
  EffectPure val -> freeVariables val
  LetRec _ binds body ->
    let bindsVars = Array.foldl (\acc (Tuple (Ident n) _) -> Set.insert (sanitizeIdent n) acc) Set.empty (NonEmptyArray.toArray binds)
        allValsVars = Array.foldl (\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (NonEmptyArray.toArray binds)
    in Set.difference (Set.union allValsVars (freeVariables body)) bindsVars
  Abs params body ->
    let paramsVars = Array.foldl (\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty (NonEmptyArray.toArray params)
    in Set.difference (freeVariables body) paramsVars
  UncurriedAbs params body ->
    let paramsVars = Array.foldl (\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty params
    in Set.difference (freeVariables body) paramsVars
  UncurriedEffectAbs params body ->
    let paramsVars = Array.foldl (\acc (Tuple mbId lvl) -> case mbId of
          Just (Ident n) -> Set.insert (sanitizeIdent n) acc
          Nothing -> Set.insert ("lvl_" <> show (unwrap lvl)) acc) Set.empty params
    in Set.difference (freeVariables body) paramsVars
  UncurriedApp fn args ->
    Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args
  UncurriedEffectApp fn args ->
    Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args
  Fail _ -> Set.empty
  EffectDefer inner -> freeVariables inner
  Lit (LitArray arr) -> Array.foldl (\acc a -> Set.union acc (freeVariables a)) Set.empty arr
  Lit (LitRecord props) -> Array.foldl (\acc (Prop _ v) -> Set.union acc (freeVariables v)) Set.empty props
  CtorSaturated _ _ _ _ fields -> Array.foldl (\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty fields
  _ -> Set.empty

inferTypeExpr :: String -> Map.Map String ExprType -> Map.Map String (Array (Tuple String ExprType)) -> Map.Map String ExprType -> NeutralExpr -> ExprType
inferTypeExpr currentMod aritiesMap globalClassFields bound (NeutralExpr expr) = case expr of
  -- A type application carries a type argument, not the result type. It is
  -- erased by code generation, so keep the representation of its expression.
  Syn.TypeApp inner _ -> inferTypeExpr currentMod aritiesMap globalClassFields bound inner
  Accessor base (GetProp k) -> 
    let baseTy = inferTypeExpr currentMod aritiesMap globalClassFields bound base
        findFieldTy (ADT _ fqn _) =
          let modStr = String.joinWith "_" (Array.dropEnd 1 fqn)
              nameStr = fromMaybe "" (Array.last fqn)
          in case Map.lookup (modStr <> "_" <> nameStr) globalClassFields of
               Just classFields -> case Array.find (\(Tuple fn _) -> fn == k) classFields of
                 Just (Tuple _ t) -> t
                 Nothing -> Any
               Nothing -> Any
        findFieldTy _ = Any
    in findFieldTy (unwrapType baseTy)
  Accessor _ (GetCtorField (Qualified mbMod _) _ _ (Ident ctorName) _ fieldIdx) ->
    let modStr = case mbMod of
          Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn
          Nothing -> currentMod
        ctorFqn = modStr <> "_" <> sanitizeIdent ctorName
    in case Map.lookup ctorFqn aritiesMap of
         Just ctorTy -> 
           let args = extractAllArgTypes ctorTy
           in case Array.index args fieldIdx of
             Just t -> t
             Nothing -> Debug.trace ("Warning: fieldIdx " <> show fieldIdx <> " out of bounds for " <> ctorFqn <> " (args len: " <> show (Array.length args) <> ")") \_ -> Any
         Nothing -> Debug.trace ("Warning: ctorFqn not found in aritiesMap: " <> ctorFqn) \_ -> Any
  


  App fn args -> applicationResultType (NonEmptyArray.length args)
    (inferTypeExpr currentMod aritiesMap globalClassFields bound fn)


  UncurriedApp fn _args -> 
    case unwrapType (inferTypeExpr currentMod aritiesMap globalClassFields bound fn) of
      Func _ retTy -> retTy
      _ -> Any
  UncurriedEffectApp fn args -> 
    case unwrapType (inferTypeExpr currentMod aritiesMap globalClassFields bound fn) of
      Func _ retTy -> retTy
      _ -> Any
  Abs params _ -> Func (map (\_ -> Any) (NonEmptyArray.toArray params)) Any
  UncurriedAbs params _ -> Func (map (\_ -> Any) params) Any
  UncurriedEffectAbs params _ -> Func (map (\_ -> Any) params) Any
  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap globalClassFields bound inner
  EffectBind _ _ _ _ -> Any
  EffectPure _ -> Any
  EffectDefer _ -> Any
  Branch branches def ->
    let defTy = inferTypeExpr currentMod aritiesMap globalClassFields bound def
    in case defTy of
      Any -> 
        let Pair _ body = NonEmptyArray.head branches
        in inferTypeExpr currentMod aritiesMap globalClassFields bound body
      _ -> defTy
  Typed ty inner ->
    -- Code generation also discards nested Typed wrappers. Infer from the same
    -- expression so an obsolete inner annotation cannot change its Rust shape.
    let stripTyped (NeutralExpr (Typed _ nested)) = stripTyped nested
        stripTyped other = other
    in case stripTyped inner of
      NeutralExpr (Let _ _ _ _) | unwrapType ty /= Any ->
        inferTypeExpr currentMod aritiesMap globalClassFields bound (annotateScopedResult ty (stripTyped inner))
      NeutralExpr (LetRec _ _ _) | unwrapType ty /= Any ->
        inferTypeExpr currentMod aritiesMap globalClassFields bound (annotateScopedResult ty (stripTyped inner))
      _ ->
        let innerTy = inferTypeExpr currentMod aritiesMap globalClassFields bound (stripTyped inner)
        in case unwrapType ty, unwrapType innerTy of
          Any, _ -> innerTy
          _, Any -> ty
          Func _ _, Func _ _ -> case stripTyped inner of
            NeutralExpr (Abs _ _) -> ty
            NeutralExpr (UncurriedAbs _ _) -> ty
            NeutralExpr (UncurriedEffectAbs _ _) -> ty
            -- A global alias can instantiate a polymorphic result as another
            -- function. Keep its TAST signature so boxUnbox adapts the arity.
            NeutralExpr (Var _) -> ty
            _ | getArity ty /= getArity innerTy -> innerTy
            _ -> ty
          _, Func _ _ -> innerTy
          Func _ _, Boolean -> innerTy
          Func _ _, Int -> innerTy
          Func _ _, Number -> innerTy
          Func _ _, String -> innerTy
          Func _ _, Char -> innerTy
          Func _ _, ADT _ _ _ -> innerTy
          -- `unsafeCoerce` can carry a `Unit` annotation over a real payload
          -- (`VariantRep Unit` in Data.Variant.unvariant). The Rust shape must
          -- follow the value, not the obsolete annotation.
          Unit, _ | innerTy /= Unit -> innerTy
          _, _ -> ty
  CtorSaturated (Qualified mbMod _) _ (ProperName tyNameStr) _ _ -> 
    let modStr = case mbMod of
          Just (ModuleName mn) -> mn
          Nothing -> currentMod
    in ADT modStr [modStr, tyNameStr] []
  CtorDef _ (ProperName tyNameStr) (Ident ctorName) _ -> fromMaybe Any (Map.lookup (currentMod <> "_" <> sanitizeIdent ctorName) aritiesMap)
  Var (Qualified mbMod (Ident name)) -> 
        let modPrefix = case mbMod of
              Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
              Nothing -> String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_"
            fullName = modPrefix <> sanitizeIdent name
        in case Map.lookup fullName aritiesMap of
          Just ty -> ty
          Nothing -> Any
  Local mbName lvl ->
    let name = case mbName of
          Just (Ident n) -> sanitizeIdent n
          Nothing -> "lvl_" <> show (unwrap lvl)
    in case Map.lookup name bound of
      Just ty -> ty
      Nothing -> Any
  Let (Just (Ident i)) _ val body -> inferTypeExpr currentMod aritiesMap globalClassFields (Map.insert (sanitizeIdent i) (inferTypeExpr currentMod aritiesMap globalClassFields bound val) bound) body
  Let Nothing _ _ inner -> inferTypeExpr currentMod aritiesMap globalClassFields bound inner

  PrimOp (Op1 op _) -> case op of
    OpBooleanNot -> Boolean
    OpIntBitNot -> Int
    OpIntNegate -> Int
    OpNumberNegate -> Number
    OpArrayLength -> Int
    OpIsTag _ -> Boolean
    _ -> Any
  PrimOp (Op2 op _ _) -> case op of
    OpIntNum _ -> Int
    OpIntBitAnd -> Int
    OpIntBitOr -> Int
    OpIntBitXor -> Int
    OpIntBitShiftLeft -> Int
    OpIntBitShiftRight -> Int
    OpIntBitZeroFillShiftRight -> Int
    OpNumberNum _ -> Number
    OpBooleanAnd -> Boolean
    OpBooleanOr -> Boolean
    OpBooleanOrd _ -> Boolean
    OpIntOrd _ -> Boolean
    OpNumberOrd _ -> Boolean
    OpStringOrd _ -> Boolean
    OpCharOrd _ -> Boolean
    OpStringAppend -> String
    _ -> Any
  Lit lit -> case lit of
    LitInt _ -> Int
    LitNumber _ -> Number
    LitString _ -> String
    LitChar _ -> Char
    LitBoolean _ -> Boolean
    _ -> Any
  _ -> Any

getArity :: ExprType -> Int
getArity (ForAll _ t) = getArity t
getArity (ConstrainedType cs t) = Array.length cs + getArity t
getArity (Func args t) = Array.length args + getArity t
getArity _ = 0



-- A raw field identifier cannot be spliced into Record_* or get_/set_* names.
-- Preserve public/FFI spellings and distinct fields such as match_kw. Raw
-- identifiers are used only at the actual struct field declaration/access.
-- sanitizeIdent already rewrites type, fn, break, mod, as, gen, use, pub, ref,
-- mut, move, let, if and loop to their *_kw names.
rawFieldKeywords :: Set.Set String
rawFieldKeywords = Set.fromFoldable
  [ "abstract", "async", "await", "become", "box", "const", "continue", "do"
  , "dyn", "else", "enum", "extern", "false", "final", "for", "impl", "in"
  , "macro", "match", "override", "priv", "return", "static", "struct"
  , "trait", "true", "try", "typeof", "unsafe", "unsized", "virtual"
  , "where", "while", "yield"
  ]

-- rustc rejects r#self, r#Self, r#super and r#crate, so these labels take the
-- same *_kw suffix as the sanitizeIdent rewrites; fieldRenames disambiguates a
-- literal self_kw twin instead of letting the two share one Rust field.
unrawableFieldKeywords :: Set.Set String
unrawableFieldKeywords = Set.fromFoldable [ "crate", "self", "Self", "super" ]

-- Labels that participate in the Rust field namespace. The CLI unions the
-- record row labels with the class dictionary fields before resolving names.
shapeLabels :: Set.Set String -> Set.Set String
shapeLabels shapes = Set.fromFoldable (Array.filter (not <<< String.null)
  (Array.concatMap (\shape -> String.split (Pattern ",") shape) (Array.fromFoldable shapes)))

-- Compilation-wide label -> Rust spelling. Labels that collide after the
-- per-label rewriting (a keyword and its literal *_kw twin) keep the canonical
-- spelling for the first label in sorted order and take _1, _2, ... after it,
-- so the mapping stays injective and stable across modules.
fieldRenames :: Set.Set String -> Map.Map String String
fieldRenames labels = (Array.foldl assign { renames: Map.empty, used: Set.empty } entries).renames
  where
  entries = Array.sortBy compare (Array.fromFoldable labels)

  assign acc label =
    let candidate = fresh (fieldBasePure label) 0 acc.used
    in { renames: Map.insert label candidate acc.renames, used: Set.insert candidate acc.used }

  fresh candidate suffix used =
    let name = if suffix == 0 then candidate else candidate <> "_" <> show suffix
    in if Set.member name used then fresh candidate (suffix + 1) used else name

-- Composite names (Record_* structs and get_/set_/borrow methods) cannot use
-- raw identifiers, so they read the safe spelling from the rename map.
fieldBase :: Map.Map String String -> String -> String
fieldBase renames field = fromMaybe (fieldBasePure field) (Map.lookup field renames)

fieldBasePure :: String -> String
fieldBasePure field
  | Set.member field unrawableFieldKeywords = field <> "_kw"
  | otherwise = case sanitizeIdent field of
      -- Rust identifiers cannot start with a digit, and a lone underscore is
      -- a wildcard, not a name.
      "_" -> "_underscore"
      name | startsWithDigit name -> "_" <> name
      name -> name
  where
  startsWithDigit name = case SCU.charAt 0 name of
    Just c -> c >= '0' && c <= '9'
    Nothing -> false

recordFieldIdent :: Map.Map String String -> String -> String
recordFieldIdent renames field
  | Set.member field rawFieldKeywords = "r#" <> field
  | otherwise = fieldBase renames field

sanitizeIdent :: String -> String
sanitizeIdent s = 
  let s1 = String.replaceAll (Pattern "'") (Replacement "_prime") s
      s2 = String.replaceAll (Pattern "$") (Replacement "_dollar_") s1
      s3 = String.replaceAll (Pattern "-") (Replacement "_minus_") s2
      -- Anonymous instance dictionaries can contain quoted Symbol literals.
      s4 = String.replaceAll (Pattern "\"") (Replacement "_quote_")
        (String.replaceAll (Pattern ".") (Replacement "_dot_") s3)
  in if s4 == "type" then "type_kw" 
     else if s4 == "fn" then "fn_kw" 
     else if s4 == "break" then "break_kw"
     else if s4 == "mod" then "mod_kw"
     else if s4 == "as" then "as_kw"
     else if s4 == "gen" then "gen_kw"
     else if s4 == "use" then "use_kw"
     else if s4 == "pub" then "pub_kw"
     else if s4 == "ref" then "ref_kw"
     else if s4 == "mut" then "mut_kw"
     else if s4 == "move" then "move_kw"
     else if s4 == "let" then "let_kw"
     else if s4 == "if" then "if_kw"
     else if s4 == "loop" then "loop_kw"
     else s4

dedupArgs :: Array String -> Array String
dedupArgs arr =
  let
    step acc item =
      let count = Map.lookup item acc.counts
      in case count of
        Nothing ->
          { result: Array.snoc acc.result item, counts: Map.insert item 1 acc.counts }
        Just c ->
          let newItem = item <> "_" <> show c
          in { result: Array.snoc acc.result newItem, counts: Map.insert item (c + 1) acc.counts }
  in (Array.foldl step { result: [], counts: Map.empty } arr).result
