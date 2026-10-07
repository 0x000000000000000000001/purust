module LinearLab.BorrowedViews.Valid where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

program :: Effect Int
program = B.withBuffer "ab" \buffer -> B.do
  first <- B.withView buffer \view -> B.do
    once <- B.checksum view
    twice <- B.checksum view
    B.pure (once + twice)
  B.append buffer "c"
  next <- B.withView buffer B.checksum
  B.pure (first + next)
