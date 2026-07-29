module Main where

import Prelude
import Effect.Console (log)

data Shape = Circle Int | Rect Int Int | Label String

main = log "Shape test"
