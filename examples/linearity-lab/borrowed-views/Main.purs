module LinearLab.BorrowedViews.Main where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Valid (program)
import LinearLab.BorrowedViews.Api (Ready)

-- Explicit dependency for native test support's direct adapter verification.
type AdapterDependency = Ready
foreign import check :: Int -> Int -> Effect Unit
foreign import verify :: Effect Unit

main :: Effect Unit
main = do
  first <- program
  replay <- program
  check first replay
  verify
