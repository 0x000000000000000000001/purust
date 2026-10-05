module LinearLab.Automatic.ClosureReplay where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  let complete _ = Native.finish session
  _ <- complete unit
  complete unit
