module LinearLab.Automatic.FreshReplay where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  let allocate = Native.open 10
  first <- allocate
  second <- allocate
  _ <- Native.finish first
  Native.finish second
