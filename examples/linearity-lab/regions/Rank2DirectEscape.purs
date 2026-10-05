module LinearLab.Regions.Rank2DirectEscape where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Rank2 as R

-- Rejected: the fresh callback scope cannot unify with the caller's scope.
escapedHandle :: forall scope. Effect (R.Handle scope)
escapedHandle = R.withHandle \handle -> pure handle
