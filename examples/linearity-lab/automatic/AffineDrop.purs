module LinearLab.Automatic.AffineDrop where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  _ <- Native.open 10
  pure 0
