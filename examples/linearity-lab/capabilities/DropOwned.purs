module LinearLab.Capabilities.DropOwned where

import Prelude (Unit)
import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Owned Unit
bad = S.drop
