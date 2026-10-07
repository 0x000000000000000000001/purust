module LinearLab.Capabilities.Escape where

import Effect (Effect)
import LinearLab.Capabilities.Sub as S
bad :: Effect S.Owned
bad = S.runInt S.openOwned 1
