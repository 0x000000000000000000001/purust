module LinearLab.Capabilities.DoubleConsume where

import Prelude ((>>>))
import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Owned Int
bad = S.finishOwned >>> S.finishOwned
