module LinearLab.Combinators.HistoricalCoerceBorrow where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Borrow)
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: Borrow Session -> Borrow Int
invalid = coerce
