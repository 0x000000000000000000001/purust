module LinearLab.Capabilities.ExtensionDemo where

import Prelude (Unit, bind, (>>>))
import Effect (Effect)
import LinearLab.Capabilities.Sub as S
import LinearLab.Capabilities.ForeignExample as F

foreign import verify :: Int -> Int -> Effect Unit

main :: Effect Unit
main = do
  size <- S.runInt (F.attach >>> F.appendByte >>> F.sizeAndClose) 10
  discarded <- S.runInt (F.attach >>> S.drop >>> S.zero) 10
  verify size discarded
