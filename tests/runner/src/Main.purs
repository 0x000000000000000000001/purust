module Main where

import Prelude
import Effect.Console (log)

foo :: String -> String -> String
foo a b = 
  let x = a <> b
      y = x <> x
  in y

main = log "Done"
