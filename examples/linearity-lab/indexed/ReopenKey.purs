module LinearLab.Indexed.ReopenKey where
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Effect Int
bad = R.run R.do
  old <- R.open (Proxy :: Proxy "resource") 1
  _ <- R.finish old
  _ <- R.open (Proxy :: Proxy "resource") 2
  -- Without a history row, this old alias could consume the new resource.
  R.finish old
