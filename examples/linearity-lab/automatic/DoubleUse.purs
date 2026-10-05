module LinearLab.Automatic.DoubleUse where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  let alias = session
  _ <- Native.finish session
  Native.finish alias
