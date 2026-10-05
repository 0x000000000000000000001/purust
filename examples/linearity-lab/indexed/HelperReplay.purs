module LinearLab.Indexed.HelperReplay where
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Effect Int
bad = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  let consume _ = R.finish resource
  _ <- consume 1
  consume 2
