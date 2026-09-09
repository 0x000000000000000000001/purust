module FunctionFusion where

import Prelude

type Iterator a = (a -> a) -> a -> a

empty :: forall a. Iterator a
empty _ x = x

next :: forall a. Iterator a -> Iterator a
next previous f x = f (previous f x)

repeat :: Int -> Iterator Int
repeat 0 = empty
repeat n = next (repeat (n - 1))

data Saved = Saved (Iterator Int)
data Applied = Applied (Int -> Int)

save :: Int -> Saved
save n = Saved (repeat n)

useSaved :: Saved -> Iterator Int
useSaved (Saved iterator) f x = iterator f x

saveCallback :: Int -> (Int -> Int) -> Applied
saveCallback n f = Applied (repeat n f)

useApplied :: Applied -> Int -> Int
useApplied (Applied f) x = f x

-- These near misses must retain their original producer.
byTwo :: Int -> Iterator Int
byTwo 0 = empty
byTwo n = next (byTwo (n - 2))

nonIdentity :: Int -> Iterator Int
nonIdentity 0 = \f x -> f x
nonIdentity n = next (nonIdentity (n - 1))

withCounter :: Int -> Iterator Int
withCounter 0 = empty
withCounter n = let previous = withCounter (n - 1) in \f x -> f (previous f x + n)
