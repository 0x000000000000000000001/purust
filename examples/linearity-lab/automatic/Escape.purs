module LinearLab.Automatic.Escape where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect (Effect Int)
program = do
  session <- Native.open 10
  pure (Native.finish session)
