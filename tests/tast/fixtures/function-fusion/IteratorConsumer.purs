module IteratorConsumer where

import FunctionFusion (repeat)

apply :: Int -> (Int -> Int) -> Int -> Int
apply n f x = repeat n f x
