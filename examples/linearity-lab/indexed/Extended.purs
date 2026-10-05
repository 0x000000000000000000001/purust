module LinearLab.Indexed.Extended where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.BranchBoth (choose)
import LinearLab.Indexed.ScopedCallbacks (recursive, repeatedCallback)
import LinearLab.Indexed.DynamicScopes (allocateMany)

foreign import checkResults :: Int -> Int -> Int -> Int -> Int -> Effect Unit

main :: Effect Unit
main = do
  left <- choose true
  right <- choose false
  loop <- recursive
  callback <- repeatedCallback
  dynamic <- allocateMany 3
  checkResults left right loop callback dynamic
