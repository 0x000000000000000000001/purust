module LinearLab.Regions.RegionActionEscape where

import Prelude
import LinearLab.Regions.Region as R

-- Rejected: unlike Effect, the deferred action retains its scope index.
escapedAction :: forall scope. R.Region scope Int
escapedAction = R.runRegion do
  handle <- R.open 10
  pure (R.finish handle)
