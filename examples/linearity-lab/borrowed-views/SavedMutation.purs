module LinearLab.BorrowedViews.SavedMutation where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

bad :: Effect Unit
bad = B.withBuffer "ab" \buffer ->
  let saved = B.append buffer "c"
  in B.withView buffer \_ -> saved
