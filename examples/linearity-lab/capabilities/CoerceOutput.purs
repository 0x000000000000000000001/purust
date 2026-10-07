module LinearLab.Capabilities.CoerceOutput where

import Safe.Coerce (coerce)
import LinearLab.Capabilities.Sub as S
newtype Wrapped = Wrapped S.Owned
bad :: S.Sub Int Wrapped
bad = coerce S.openOwned
