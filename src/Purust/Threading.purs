module Purust.Threading (threadedRust, threadedPrelude) where

-- The Rust scanner preserves literals and comments, including user strings.
foreign import threadedRust :: String -> String
foreign import threadedPrelude :: String -> String
