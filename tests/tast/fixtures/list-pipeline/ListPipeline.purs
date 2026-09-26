module ListPipeline where

import Prelude

-- Mirror of Test.ListOps so the fusion pass can be exercised on fresh TAST.

data List a = Nil | Cons a (List a)

range :: Int -> Int -> List Int
range start end = go end Nil
  where
  go curr acc =
    if curr < start then acc
    else go (curr - 1) (Cons curr acc)

filterEvens :: List Int -> List Int
filterEvens lst = go lst Nil
  where
  go Nil acc = acc
  go (Cons x xs) acc =
    if x `mod` 2 == 0 then go xs (Cons x acc)
    else go xs acc

foldl :: forall a b. (b -> a -> b) -> b -> List a -> b
foldl _ acc Nil = acc
foldl f acc (Cons x xs) = foldl f (f acc x) xs

sumEvens :: Int -> Int
sumEvens n = foldl (+) 0 (filterEvens (range 1 n))

sumEvensFrom :: Int -> Int -> Int
sumEvensFrom start n = foldl (+) 0 (filterEvens (range start n))

productEvens :: Int -> Int
productEvens n = foldl (*) 1 (filterEvens (range 1 n))

-- Near misses that must keep the original producers.

filterAll :: List Int -> List Int
filterAll lst = go lst Nil
  where
  go Nil acc = acc
  go (Cons x xs) acc = go xs (Cons x acc)

sumAll :: Int -> Int
sumAll n = foldl (+) 0 (filterAll (range 1 n))

diffEvens :: Int -> Int
diffEvens n = foldl (-) 0 (filterEvens (range 1 n))
