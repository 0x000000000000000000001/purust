module LinearLab.BorrowedViews.NestedBorrow where

import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

-- Conservative API: even a second shared read scope is forbidden, although
-- Rust can support multiple shared references. This is a limitation.
bad :: Effect Int
bad = B.withBuffer "ab" \buffer -> B.withView buffer \_ ->
  B.withView buffer B.checksum
