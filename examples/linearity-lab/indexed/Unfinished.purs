module LinearLab.Indexed.Unfinished where
import Prelude (Unit, unit)
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Effect Unit
bad = R.run R.do
  _ <- R.open (Proxy :: Proxy "resource") 1
  R.pure unit
