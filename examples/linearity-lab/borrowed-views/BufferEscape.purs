module LinearLab.BorrowedViews.BufferEscape where

import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

bad :: forall scope. Effect (B.Buffer scope)
bad = B.withBuffer "ab" B.pure
