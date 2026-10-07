module LinearLab.BorrowedViews.MutationDuringBorrow where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

bad :: Effect Unit
bad = B.withBuffer "ab" \buffer ->
  B.withView buffer \_ -> B.append buffer "c"
