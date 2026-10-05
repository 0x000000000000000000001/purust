module LinearLab.Automatic.DisjointArgs where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  first <- Native.open 10
  second <- Native.open 20
  _ <- Native.combine first second
  _ <- Native.finish first
  Native.finish second
