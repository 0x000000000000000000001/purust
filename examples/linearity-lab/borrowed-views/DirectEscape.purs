module LinearLab.BorrowedViews.DirectEscape where

import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

bad :: forall scope view. Effect (B.View scope view)
bad = B.withBuffer "ab" \buffer -> B.withView buffer B.pure
