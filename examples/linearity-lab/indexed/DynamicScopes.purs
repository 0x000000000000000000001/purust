module LinearLab.Indexed.DynamicScopes where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (withSession)

-- Dynamic repetition works at Effect level when each iteration gets a fresh
-- scope. This does not build an arbitrary live collection in a shared arena.
allocateMany :: Int -> Effect Int
allocateMany remaining =
  if remaining <= 0 then pure 0
  else do
    value <- withSession remaining R.finish
    rest <- allocateMany (remaining - 1)
    pure (value + rest)
