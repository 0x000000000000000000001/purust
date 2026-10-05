module LinearLab.Automatic.Valid where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

program :: Effect Int
program = do
  session <- Native.open 10
  _ <- Native.add session 5
  _ <- Native.inspect session
  Native.finish session
