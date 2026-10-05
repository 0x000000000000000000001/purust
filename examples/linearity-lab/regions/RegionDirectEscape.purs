module LinearLab.Regions.RegionDirectEscape where

import Prelude
import LinearLab.Regions.Region as R

escapedHandle :: forall scope. R.Handle scope
escapedHandle = R.runRegion do
  handle <- R.open 10
  pure handle
