module LinearLab.Regions.RegionExistsUse where

import LinearLab.Regions.Region as R
import LinearLab.Regions.RegionExists (SomeHandle(..))

-- Rejected: hiding a scope is not a license to choose it for runRegion.
usePacked :: SomeHandle -> Int
usePacked (SomeHandle unpack) = unpack \handle -> R.runRegion (R.finish handle)
