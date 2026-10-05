module LinearLab.Automatic.UnknownBranch where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  value <- Native.inspect session
  if value == 10 then Native.finish session else Native.finish session
