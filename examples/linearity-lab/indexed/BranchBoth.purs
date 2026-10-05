module LinearLab.Indexed.BranchBoth where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import LinearLab.Indexed.Helpers (withSession)

choose :: Boolean -> Effect Int
choose left = withSession 5 \resource ->
  if left then R.do
    R.add resource 2
    R.finish resource
  else R.do
    R.add resource 3
    R.finish resource
