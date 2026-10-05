module LinearLab.Automatic.ReadAfterFinish where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  _ <- Native.finish session
  Native.inspect session
