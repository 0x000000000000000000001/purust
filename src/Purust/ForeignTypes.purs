module Purust.ForeignTypes (foreignTypeForwards, foreignUnboundTypes) where

foreign import foreignTypeForwards :: String -> String -> String
foreign import foreignUnboundTypes :: String -> String -> Array String
