module LinearLab.Combinators.HistoricalCoerceOutput where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Sub)
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: Sub Int Session -> Sub Int Int
invalid = coerce
