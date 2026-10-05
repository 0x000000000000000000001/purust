module LinearLab.Indexed.ScopedCallbacks where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (withSession, borrowLoop, repeatBorrow, consumeWith)

-- No Proxy, phantom-state declaration or row annotation at these call sites.
recursive :: Effect Int
recursive = withSession 10 \resource -> R.do
  observed <- borrowLoop resource 4
  final <- consumeWith resource \session -> R.do
    value <- R.finish session
    R.pure (value + 1)
  R.pure (observed + final)

repeatedCallback :: Effect Int
repeatedCallback = withSession 4 \resource -> R.do
  repeatBorrow 3 (\step -> R.add resource step)
  consumeWith resource R.finish
