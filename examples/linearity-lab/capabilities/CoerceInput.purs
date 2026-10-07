module LinearLab.Capabilities.CoerceInput where

import Safe.Coerce (coerce)
import LinearLab.Capabilities.Sub as S
newtype Wrapped = Wrapped S.Owned
bad :: S.Sub Wrapped Int
bad = coerce S.finishOwned
