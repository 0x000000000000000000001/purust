module FunctionBorrows where

import Prelude

data Callback = Callback (Callback -> Int)

callTwice :: (Int -> Int) -> Int -> Int
callTwice f k = f k + f (k + 1)

nestedCalls :: (Int -> Int) -> Int -> Int
nestedCalls f k = f (f k)

binaryTwice :: (Int -> Int -> Int) -> Int -> Int
binaryTwice f k = f k 1 + f k 2

throughCapture :: (Int -> Int) -> Int -> ((Unit -> Int) -> Int) -> Int
throughCapture f k use = use (\_ -> f k)

passSelf :: (Callback -> Int) -> Int
passSelf f = f (Callback f)

captureSelf :: (Callback -> Int) -> Int
captureSelf f = f (Callback (\arg -> f arg))

holdPartial :: (Int -> Int -> Int) -> Int -> ((Int -> Int) -> Int) -> Int
holdPartial f k use = use (f k) + f 2 3
