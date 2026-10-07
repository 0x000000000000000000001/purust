module LinearLab.Capabilities.CloneOwned where

import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Owned (S.Pair S.Owned S.Owned)
bad = S.clone
