module LinearLab.Regions.Rank2Alias where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Rank2 as R

-- Accepted: the scoped type does not prevent duplicating its value.
doubleFinish :: Effect Int
doubleFinish = R.withHandle \handle -> do
  let alias = handle
  _ <- R.finish handle
  R.finish alias
