module Main where

import Effect.Console (log)

main = do
  let r1 = { a: 1 }
  let r2 = r1 { a = 2 }
  log "ok"
