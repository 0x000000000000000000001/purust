module LinearLab.Capabilities.DoubleConsumeForeign where

import Prelude ((>>>))
import LinearLab.Capabilities.Sub as S
import LinearLab.Capabilities.ForeignExample as F
bad :: S.Sub F.Attachment Int
bad = F.sizeAndClose >>> F.sizeAndClose
