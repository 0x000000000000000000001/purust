module LinearLab.Automatic.ReplayConsume where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  let action = Native.finish session
  _ <- action
  action
