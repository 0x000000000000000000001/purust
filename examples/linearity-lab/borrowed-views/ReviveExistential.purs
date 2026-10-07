module LinearLab.BorrowedViews.ReviveExistential where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B
import LinearLab.BorrowedViews.Existential (escaped, unpack)

bad :: Effect Int
bad = do
  packed <- escaped
  B.withBuffer "new" \buffer -> B.withView buffer \_ ->
    unpack packed B.checksum
