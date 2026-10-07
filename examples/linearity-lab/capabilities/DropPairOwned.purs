module LinearLab.Capabilities.DropPairOwned where

import Prelude (Unit)
import LinearLab.Capabilities.Sub as S
bad :: S.Sub (S.Pair S.Disposable S.Owned) Unit
bad = S.drop
