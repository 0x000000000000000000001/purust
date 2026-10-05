module LinearLab.Combinators.HistoricalEscape where
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource as R
invalid :: Int -> R.Session
invalid = H.runShared R.open
