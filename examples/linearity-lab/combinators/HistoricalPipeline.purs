module LinearLab.Combinators.HistoricalPipeline where
import Prelude
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource as R
valid :: Int -> Int
valid = H.runShared (R.finish <<< R.open)
