module LinearLab.Indexed.AliasedFinish where
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad :: Effect Int
bad = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  let alias = resource
  _ <- R.finish resource
  R.finish alias
