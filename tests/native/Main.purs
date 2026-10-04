module Main where

import Prelude
import Data.Array as Array
import Effect (Effect)
import Effect.Console (log)

foreign import checkZero :: Boolean -> Number -> Effect Unit
foreign import runtimeZero :: Effect Number
foreign import data Handle' :: Type
foreign import makeHandle :: Effect Handle'
foreign import checkHandle :: forall a. a -> Effect Unit

data Result = Answer { total :: Int, label :: String } | Missing

render :: Result -> String
render = case _ of
  Answer result -> result.label <> " " <> show result.total
  Missing -> "missing"

main :: Effect Unit
main = do
  -- FFI observes the sign at runtime, after both compiler hosts fold literals.
  checkZero true (negate 0.0)
  checkZero false (negate (negate 0.0))
  zero <- runtimeZero
  checkZero true (negate zero)
  checkZero false (negate (negate zero))
  handle <- makeHandle
  checkHandle handle
  log (render (Answer
    { total: Array.foldl (+) 0 (map (_ * 2) (Array.range 1 6))
    , label: "PURUST_NATIVE_OK"
    }))
