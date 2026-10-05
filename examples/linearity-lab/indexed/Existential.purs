module LinearLab.Indexed.Existential (Packed, withPacked, escaped) where

import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))

-- A closed handle CAN escape inside an existential package. Its hidden scope
-- still prevents using it in another run; rank-2 types do not prohibit storage.
newtype Packed = Packed
  (forall result. (forall scope key. R.Handle scope key -> result) -> result)

withPacked :: forall result.
  Packed -> (forall scope key. R.Handle scope key -> result) -> result
withPacked (Packed use) consumer = use consumer

pack :: forall scope key. R.Handle scope key -> Packed
pack resource = Packed (\consumer -> consumer resource)

escaped :: Effect Packed
escaped = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  _ <- R.finish resource
  R.pure (pack resource)
