module AffFatalProbe where

import Effect (Effect)
import Effect.Aff (Aff, launchAff_)
import Prelude (Unit)

launch :: Aff Unit -> Effect Unit
launch = launchAff_
