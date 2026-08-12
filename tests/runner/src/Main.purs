module Main where

import Prelude
import Effect.Console (log)
import Foreign.Object as FO

x :: forall a. a -> String
x a = y "Test"
  where
  y :: forall a. Show a => a -> String
  y a = show (a :: a)

main = do
  log (x 0)
  log "Done"
  let _ = FO.empty
  pure unit
