module Purust.Utf16 (runtimeHelpers, rustStringLiteral, rustCharLiteral) where

foreign import runtimeHelpers :: String
foreign import rustStringLiteral :: String -> String
foreign import rustCharLiteral :: Char -> String
