module LinearLab.Indexed.ReviveExistential where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Existential (escaped, withPacked)
import Type.Proxy (Proxy(..))

bad :: Effect Int
bad = do
  old <- escaped
  R.run R.do
    current <- R.open (Proxy :: Proxy "resource") 2
    -- The resource name is the same at runtime. Its scope/key type cannot be
    -- exchanged with the existential old handle to acquire its capability.
    result <- withPacked old (\stale -> R.inspect stale)
    _ <- R.finish current
    R.pure result
