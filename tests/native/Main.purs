module Main where

import Prelude
import Data.Array as Array
import Effect (Effect)
import Effect.Console (log)

data Result = Answer { total :: Int, label :: String } | Missing

render :: Result -> String
render = case _ of
  Answer result -> result.label <> " " <> show result.total
  Missing -> "missing"

main :: Effect Unit
main = log (render (Answer
  { total: Array.foldl (+) 0 (map (_ * 2) (Array.range 1 6))
  , label: "PURUST_NATIVE_OK"
  }))
