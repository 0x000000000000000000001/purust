module LinearLab.Indexed.ScopedUnfinished where

import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (withSession)

bad :: Effect Int
bad = withSession 4 \_ -> R.pure 0
