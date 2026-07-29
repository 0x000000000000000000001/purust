module Main where

import Prelude (Unit, unit)
import Effect (Effect)

foreign import logRecord :: { a :: Int } -> Effect Unit

foreign import getRecord :: Unit -> { a :: Int }

updateRecord :: { a :: Int } -> { a :: Int }
updateRecord r = r { a = 2 }

main :: Effect Unit
main = logRecord (updateRecord (getRecord unit))
