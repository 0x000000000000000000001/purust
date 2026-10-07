module LinearLab.Capabilities.Probe where

import Prelude (Unit, (>>>))
import LinearLab.Capabilities.Sub as S

dispose :: S.Sub S.Disposable Unit
dispose = S.drop

cloneAndConsume :: S.Sub S.Deep Int
cloneAndConsume = S.twice (S.tensor S.finishDeep S.finishDeep >>> S.sumInts)

shared :: S.Sub S.SharedValue (S.Pair S.SharedValue S.SharedValue)
shared = S.share
