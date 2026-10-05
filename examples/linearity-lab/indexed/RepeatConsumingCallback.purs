module LinearLab.Indexed.RepeatConsumingCallback where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (withSession, repeatBorrow)

bad :: Effect Int
bad = withSession 4 \resource -> R.do
  repeatBorrow 3 \_ -> R.do
    _ <- R.finish resource
    R.pure unit
  R.finish resource
