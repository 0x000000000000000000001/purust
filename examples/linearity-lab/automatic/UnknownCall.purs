module LinearLab.Automatic.UnknownCall where

import Prelude
import Effect (Effect)
import LinearLab.Automatic.Native as Native

foreign import unknown :: Native.Session -> Int

program :: Effect Int
program = do
  session <- Native.open 10
  let ignored = unknown session
  Native.finish session
