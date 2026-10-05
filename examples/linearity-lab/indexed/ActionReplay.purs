module LinearLab.Indexed.ActionReplay where
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Effect Int
bad = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  let action = R.finish resource
  _ <- action
  action
