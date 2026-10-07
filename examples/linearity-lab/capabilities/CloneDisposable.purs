module LinearLab.Capabilities.CloneDisposable where

import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Disposable (S.Pair S.Disposable S.Disposable)
bad = S.clone
