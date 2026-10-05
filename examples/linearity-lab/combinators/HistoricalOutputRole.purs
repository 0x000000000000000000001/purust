module LinearLab.Combinators.HistoricalOutputRole where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Sub)
import LinearLab.Combinators.HistoricalResource (Session)
import LinearLab.Combinators.HistoricalWrapped (WrappedSession(..))
invalid :: Sub Int WrappedSession -> Sub Int Session
invalid = coerce
