module LinearLab.NativeCallbacks.Demo where

import Prelude
import Effect (Effect)
import Effect.Exception (throw)
import LinearLab.NativeCallbacks.Callbacks as C

main :: Effect Unit
main = do
  once <- C.newOnce 10
  C.assertDrops "FnOnce retains session before invocation" 0
  let alias = once
  let replay = C.invokeOnce alias (\value -> pure (value + 1))
  first <- replay
  C.assertInt "FnOnce captures non-Clone resource" 11 first
  C.assertDrops "FnOnce drops captured session on return" 1
  C.expectError "once consumed" replay
  C.expectError "once consumed" (C.invokeOnce once pure)

  failing <- C.newOnce 20
  C.assertDrops "failing FnOnce initially retains session" 1
  C.expectError "callback failure" (C.invokeOnce failing (\_ -> throw "callback failure"))
  C.assertDrops "FnOnce drops captured session on exception" 2
  C.expectError "once consumed" (C.invokeOnce failing pure)

  discarded <- C.newOnce 30
  C.assertDrops "unused FnOnce initially retains session" 2
  C.discardOnce discarded
  C.discardOnce discarded
  C.assertDrops "discard destroys captured session once" 3
  C.expectError "once consumed" (C.invokeOnce discarded pure)

  reentrant <- C.newOnce 40
  reentered <- C.invokeOnce reentrant \value -> do
    C.expectError "once consumed" (C.invokeOnce reentrant pure)
    pure value
  C.assertInt "FnOnce reentry is consumed, not a deadlock" 40 reentered
  C.assertDrops "reentrant FnOnce destroys session once" 4

  mutable <- C.newMutable 0
  C.assertDrops "FnMut retains whole non-Clone session" 4
  let step = C.invokeMutable mutable 2 pure
  firstStep <- step
  secondStep <- step
  C.assertInt "FnMut first call mutates captured state" 2 firstStep
  C.assertInt "FnMut Effect replay invokes the same state again" 4 secondStep
  C.expectError "mutable callback failure"
    (C.invokeMutable mutable 3 (\_ -> throw "mutable callback failure"))
  C.assertDrops "FnMut exception keeps captured resource alive" 4
  afterFailure <- C.invokeMutable mutable 0 pure
  C.assertInt "FnMut restores callable after failure; mutation is not rolled back" 7 afterFailure
  afterReentry <- C.invokeMutable mutable 1 \value -> do
    C.expectError "mutable callback busy" (C.invokeMutable mutable 100 pure)
    C.expectError "mutable callback busy" (C.closeMutable mutable *> pure 0)
    pure value
  C.assertInt "FnMut reentrant call and close are rejected without deadlock" 8 afterReentry
  finalStep <- C.invokeMutable mutable 2 pure
  C.assertInt "FnMut remains callable after rejected reentry" 10 finalStep
  C.assertDrops "FnMut still retains resource after all calls" 4
  C.closeMutable mutable
  C.closeMutable mutable
  C.assertDrops "FnMut close destroys captured resource once" 5
  C.expectError "mutable callback closed" (C.invokeMutable mutable 1 pure)

  unused <- C.newMutable 99
  C.assertDrops "unused FnMut keeps resource until close" 5
  C.closeMutable unused
  C.verify
