module LinearLab.Combinators.HistoricalCoerceInput where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Sub)
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: Sub Session Int -> Sub Int Int
invalid = coerce
