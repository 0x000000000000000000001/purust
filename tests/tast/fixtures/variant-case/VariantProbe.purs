module VariantProbe where

import Prelude
import Data.List (List(..))
import Data.Variant.Internal as V
import Unsafe.Coerce (unsafeCoerce)

tags :: List String
tags = Cons "int" (Cons "string" Nil)

eqs :: List (V.VariantCase -> V.VariantCase -> Boolean)
eqs = Cons (unsafeCoerce (eq :: Int -> Int -> Boolean))
  (Cons (unsafeCoerce (eq :: String -> String -> Boolean)) Nil)

ords :: List (V.VariantCase -> V.VariantCase -> Ordering)
ords = Cons (unsafeCoerce (compare :: Int -> Int -> Ordering))
  (Cons (unsafeCoerce (compare :: String -> String -> Ordering)) Nil)

rep :: forall a. String -> a -> V.VariantRep V.VariantCase
rep tag value = V.VariantRep { type: tag, value: unsafeCoerce value }

equalInts :: Int -> Int -> Boolean
equalInts x y = V.lookupEq tags eqs (rep "int" x) (rep "int" y)

equalStrings :: String -> String -> Boolean
equalStrings x y = V.lookupEq tags eqs (rep "string" x) (rep "string" y)

differentTags :: Int -> String -> Boolean
differentTags x y = V.lookupEq tags eqs (rep "int" x) (rep "string" y)

compareInts :: Int -> Int -> Ordering
compareInts x y = V.lookupOrd tags ords (rep "int" x) (rep "int" y)

compareStrings :: String -> String -> Ordering
compareStrings x y = V.lookupOrd tags ords (rep "string" x) (rep "string" y)

compareDifferentTags :: Int -> String -> Ordering
compareDifferentTags x y = V.lookupOrd tags ords (rep "int" x) (rep "string" y)

missingEq :: Int -> Int -> Boolean
missingEq x y = V.lookupEq Nil Nil (rep "absent" x) (rep "absent" y)

missingOrd :: Int -> Int -> Ordering
missingOrd x y = V.lookupOrd Nil Nil (rep "absent" x) (rep "absent" y)

differentTagsWithoutCallbacks :: Int -> String -> Boolean
differentTagsWithoutCallbacks x y = V.lookupEq Nil Nil (rep "int" x) (rep "string" y)

orderedTagsWithoutCallbacks :: Int -> String -> Ordering
orderedTagsWithoutCallbacks x y = V.lookupOrd Nil Nil (rep "int" x) (rep "string" y)
