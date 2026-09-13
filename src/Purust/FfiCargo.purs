module Purust.FfiCargo (loadFfiCargo) where

import Effect (Effect)

foreign import loadFfiCargo :: String -> Effect String
