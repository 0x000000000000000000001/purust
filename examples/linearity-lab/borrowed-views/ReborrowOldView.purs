module LinearLab.BorrowedViews.ReborrowOldView where

import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

-- Hide only the borrow token, retaining the same region. A new borrow must
-- not accidentally reactivate a view from an earlier borrow of this buffer.
newtype Packed scope = Packed
  (forall result. (forall view. B.View scope view -> result) -> result)

pack :: forall scope view. B.View scope view -> Packed scope
pack old = Packed (\use -> use old)

bad :: Effect Int
bad = B.withBuffer "ab" \buffer -> B.do
  old <- B.withView buffer \view -> B.pure (pack view)
  B.withView buffer \_ ->
    case old of
      Packed use -> use B.checksum
