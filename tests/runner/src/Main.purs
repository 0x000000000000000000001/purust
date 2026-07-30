module Main where

import Prelude

class Loggable a where
  log :: a -> String

instance Loggable Int where
  log _ = "Int"

instance Loggable String where
  log _ = "String"

printLog :: forall a. Loggable a => a -> String
printLog a = log a

main :: String
main = printLog 42 <> printLog "Hello"
