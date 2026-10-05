module LinearLab.Regions.Rank2Exists where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Rank2 as R

-- Church encoding of an existential, without depending on Data.Exists.
newtype SomeHandle = SomeHandle (forall result. (forall scope. R.Handle scope -> result) -> result)

pack :: forall scope. R.Handle scope -> SomeHandle
pack handle = SomeHandle \use -> use handle

usePacked :: SomeHandle -> Effect Int
usePacked (SomeHandle unpack) = unpack R.finish

-- Accepted: the hidden scope is absent from the result type.
escapedHandle :: Effect SomeHandle
escapedHandle = R.withHandle \handle -> pure (pack handle)

replayPacked :: Effect Int
replayPacked = do
  handle <- escapedHandle
  _ <- usePacked handle
  usePacked handle
