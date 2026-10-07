module LinearLab.Capabilities.CloneForeign where

import LinearLab.Capabilities.Sub as S
import LinearLab.Capabilities.ForeignExample as F
bad :: S.Sub F.Attachment (S.Pair F.Attachment F.Attachment)
bad = S.clone
