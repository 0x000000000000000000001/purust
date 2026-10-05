module Demo where

import Prelude
import Effect (Effect)
import Session as Session

foreign import checkResults :: Int -> Int -> Int -> Effect Unit

main :: Effect Unit
main = do
  let
    shared = Session.then_ (Session.add 5) Session.inspect
    program = Session.then_ shared (Session.then_ (Session.add 2) Session.finish)
    action = Session.run 10 program
  first <- action
  second <- action
  third <- Session.run 20 (Session.then_ shared Session.finish)
  checkResults first second third
