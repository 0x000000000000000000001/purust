module Main where
import Prelude
import Effect
import Effect.Console
import Data.Array.NonEmpty as NE

main :: Effect Unit
main = do
  log "Hello from Purust!"
  log (show (NE.intersectBy (==) (NE.singleton 1) (NE.singleton 1)))
