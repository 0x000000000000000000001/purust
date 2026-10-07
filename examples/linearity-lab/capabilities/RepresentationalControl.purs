module LinearLab.Capabilities.RepresentationalControl where

import Safe.Coerce (coerce)
import LinearLab.Capabilities.Sub as S
newtype Wrapped = Wrapped S.Owned
wrap :: S.Owned -> Wrapped
wrap = coerce
