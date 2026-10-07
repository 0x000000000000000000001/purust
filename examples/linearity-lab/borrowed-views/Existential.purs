module LinearLab.BorrowedViews.Existential (Packed, pack, unpack, escaped) where

import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

newtype Packed = Packed
  (forall result. (forall scope view. B.View scope view -> result) -> result)

pack :: forall scope view. B.View scope view -> Packed
pack view = Packed (\use -> use view)

unpack :: forall result.
  Packed -> (forall scope view. B.View scope view -> result) -> result
unpack (Packed use) consumer = use consumer

-- Storage is permitted, use is still indexed. Rank-2 is not a no-escape
-- guarantee: the package may retain the closed native owner wrapper.
escaped :: Effect Packed
escaped = B.withBuffer "ab" \buffer -> B.withView buffer \view ->
  B.pure (pack view)
