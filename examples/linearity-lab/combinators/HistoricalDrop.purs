module LinearLab.Combinators.HistoricalDrop where
import Data.Unit (Unit)
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: H.Sub Session Unit
invalid = H.drop
