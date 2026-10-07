module LinearLab.Capabilities.UnsafeControl where

import Unsafe.Coerce (unsafeCoerce)
import LinearLab.Capabilities.Sub as S
unsafeDuplicate :: S.Sub S.Owned (S.Pair S.Owned S.Owned)
unsafeDuplicate = unsafeCoerce (S.identity :: S.Sub Int Int)
