module LinearLab.Capabilities.TwiceOwned where

import Prelude ((>>>))
import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Owned Int
bad = S.twice (S.tensor S.finishOwned S.finishOwned >>> S.sumInts)
