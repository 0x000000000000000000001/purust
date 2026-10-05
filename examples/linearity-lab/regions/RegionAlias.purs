module LinearLab.Regions.RegionAlias where

import Prelude
import LinearLab.Regions.Region as R

-- Accepted: confinement does not imply at-most-once use within the scope.
doubleFinish :: Int
doubleFinish = R.runRegion do
  handle <- R.open 10
  let alias = handle
  _ <- R.finish handle
  R.finish alias
