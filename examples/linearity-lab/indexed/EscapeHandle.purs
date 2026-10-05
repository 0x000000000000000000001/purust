module LinearLab.Indexed.EscapeHandle where
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))
bad = R.run R.do
  resource <- R.open (Proxy :: Proxy "resource") 1
  _ <- R.finish resource
  R.pure resource
