module Main where

import Prelude (Unit, bind)
import Effect (Effect)

foreign import logRecord :: { a :: Int } -> Effect Unit

main :: Effect Unit
main = do
  let r1 = { a: 1 }
  logRecord r1
  let r2 = r1 { a = 2 }
  logRecord r2
