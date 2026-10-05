module LinearLab.Indexed.Valid where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Type.Proxy (Proxy(..))

foreign import checkResults :: Int -> Int -> Effect Unit

-- Users write qualified do, give fresh resource names and use ordinary handles.
-- The history/live rows are inferred here; there are no Open/Closed ADTs per API.
action :: Effect Int
action = R.run R.do
  first <- R.open (Proxy :: Proxy "first") 10
  second <- R.open (Proxy :: Proxy "second") 20
  let alias = first
  observed <- R.inspect alias
  R.add second observed
  left <- R.finish first
  right <- R.finish second
  R.pure (left + right)

main :: Effect Unit
main = do
  first <- action
  replay <- action
  checkResults first replay
