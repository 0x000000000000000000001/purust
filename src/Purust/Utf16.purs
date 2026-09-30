module Purust.Utf16 (runtimeHelpers, rustStringLiteral, rustStrLiteral, rustCharLiteral) where

foreign import runtimeHelpers :: String
foreign import rustStringLiteral :: String -> String
foreign import rustStrLiteral :: String -> String
foreign import rustCharLiteral :: Char -> String
