module LinearLab.Regions.RegionValid where

import Prelude
import LinearLab.Regions.Region as R

valid :: Int
valid = R.runRegion do
  handle <- R.open 10
  _ <- R.inspect handle
  R.finish handle
