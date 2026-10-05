module LinearLab.Indexed.PartialBranch where
import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Boolean -> Effect Int
bad close = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  if close then R.finish resource else R.pure 0
