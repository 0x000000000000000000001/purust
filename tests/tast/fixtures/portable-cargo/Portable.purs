module Portable where

import Data.Unit (Unit)
import Effect (Effect)

foreign import probe :: Effect Unit

main :: Effect Unit
main = probe
