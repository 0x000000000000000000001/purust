module LinearLab.Combinators.HistoricalClone where
import Data.Tuple (Tuple)
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: H.Sub Session (Tuple Session Session)
invalid = H.clone
