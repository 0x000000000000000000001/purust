module LinearLab.Indexed.RepeatedAllocation where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (repeatBorrow)
import Type.Proxy (Proxy(..))

-- This looks operationally reasonable: every iteration closes its resource.
-- It is rejected because allocation grows history, so this is not a repeatable
-- state-preserving callback. Dynamic resource batches need a different API.
bad :: Effect Unit
bad = R.run R.do
  repeatBorrow 3 \value -> R.do
    resource <- R.open (Proxy :: Proxy "temporary") value
    _ <- R.finish resource
    R.pure unit
