module ReturnedFunctions where

import Prelude

newtype Thunk a = Thunk (Unit -> a)

force :: forall a. Thunk a -> a
force (Thunk f) = f unit

build :: Int -> Thunk Int -> Thunk Int
build 0 acc = acc
build n acc = build (n - 1) (Thunk \_ -> force acc + 1)

partial :: Int -> Thunk Int -> Thunk Int
partial n = build n

reuse :: Int -> Int -> Int
reuse n initial =
  let pending = build n (Thunk \_ -> initial)
  in force pending + force pending

reuseCaptured :: Int -> (Unit -> Int) -> Int
reuseCaptured n f =
  let pending = partial n (Thunk f)
  in force pending + force pending

-- Two arguments remain after the explicit recursive function parameters.
binary :: Int -> (Int -> Int -> Int) -> Int -> Int -> Int
binary 0 f = f
binary n f = binary (n - 1) (\x y -> f x y + 1)

-- Recursion inside the returned closure must remain deferred.
deferred :: Int -> (Int -> Int) -> Int -> Int
deferred 0 f = f
deferred n f = \x -> deferred (n - 1) f (x + 1)

recordBase :: Unit -> { state :: Int }
recordBase _ = { state: 42 }

-- The fully applied recursive call returns a record, not another function.
recordLoop :: Int -> (Unit -> { state :: Int }) -> Unit -> { state :: Int }
recordLoop 0 f = f
recordLoop n f = \_ -> recordLoop (n - 1) f unit

generic :: forall a. Int -> (a -> a) -> a -> a
generic 0 f = f
generic n f = \x -> generic (n - 1) f (f x)
