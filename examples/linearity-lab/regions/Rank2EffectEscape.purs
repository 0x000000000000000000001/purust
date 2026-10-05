module LinearLab.Regions.Rank2EffectEscape where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Rank2 as R

-- Accepted: Effect Int contains no mention of scope in its type.
escapedAction :: Effect (Effect Int)
escapedAction = R.withHandle \handle -> pure (R.finish handle)

-- Running it twice would repeat a consuming operation on the same handle.
replay :: Effect Int
replay = do
  action <- escapedAction
  _ <- action
  action
