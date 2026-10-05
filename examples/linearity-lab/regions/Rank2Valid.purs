module LinearLab.Regions.Rank2Valid where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Rank2 as R

valid :: Effect Int
valid = R.withHandle \handle -> do
  _ <- R.inspect handle
  R.finish handle
