module LinearLab.Regions.RegionExists where

import Prelude
import LinearLab.Regions.Region as R

newtype SomeHandle = SomeHandle (forall result. (forall scope. R.Handle scope -> result) -> result)

pack :: forall scope. R.Handle scope -> SomeHandle
pack handle = SomeHandle \use -> use handle

-- Accepted but inert: clients cannot run Region scope actions for this hidden
-- scope, since runRegion requires an action valid for every scope.
escapedPackedHandle :: SomeHandle
escapedPackedHandle = R.runRegion do
  handle <- R.open 10
  pure (pack handle)
