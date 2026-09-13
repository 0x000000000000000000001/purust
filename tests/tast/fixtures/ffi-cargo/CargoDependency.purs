module CargoDependency where

import CargoValue (Native)
import Data.Unit (Unit)
import Effect (Effect)

foreign import huge :: Int -> Native
foreign import successor :: Native -> Native
foreign import render :: Native -> String
foreign import assertResult :: String -> Effect Unit

main :: Effect Unit
main = assertResult (render (successor (huge 0)))
