module LinearLab.Combinators.HistoricalInputRole where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Sub)
import LinearLab.Combinators.HistoricalResource (Session)
import LinearLab.Combinators.HistoricalWrapped (WrappedSession(..))
invalid :: Sub WrappedSession Int -> Sub Session Int
invalid = coerce
