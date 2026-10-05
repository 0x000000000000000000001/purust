module LinearLab.Combinators.HistoricalCoerceEscape where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource as R
-- Attempt to hide the resource behind shared Int so runShared accepts it.
invalid :: Int -> Int
invalid = H.runShared (coerce R.open :: H.Sub Int Int)
