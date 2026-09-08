module PolyConsumer where

import Prelude
import Data.Array (length)
import PolyLoop (class Monoidish, polyLoop, repeatWith)

intLoop :: Int -> Int -> Int
intLoop n initial = polyLoop n initial

numberLoop :: Int -> Number -> Number
numberLoop n initial = polyLoop n initial

intPartial :: Int -> Int -> Int
intPartial n = polyLoop n

reusePartial :: Int -> Int -> Int
reusePartial n initial =
  let next = polyLoop n
  in next initial + next (initial + 1)

generic :: forall b. Monoidish b => Int -> b -> b
generic n initial = polyLoop n initial

mixed :: Int -> Int -> Int
mixed n initial = repeatWith (\acc add -> if add then acc + 2 else acc) true n initial

arrayLength :: Array Int -> Int
arrayLength xs = length xs
