module LinearLab.Combinators.HistoricalShared where
import Prelude
import LinearLab.Combinators.Historical as H
valid :: Int -> Int
valid = H.runShared (H.liftShared (\n -> n + 1))
