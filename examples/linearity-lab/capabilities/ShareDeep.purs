module LinearLab.Capabilities.ShareDeep where

import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Deep (S.Pair S.Deep S.Deep)
bad = S.share
