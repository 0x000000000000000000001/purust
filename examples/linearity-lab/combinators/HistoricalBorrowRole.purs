module LinearLab.Combinators.HistoricalBorrowRole where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Historical (Borrow)
import LinearLab.Combinators.HistoricalResource (Session)
import LinearLab.Combinators.HistoricalWrapped (WrappedSession(..))
invalid :: Borrow WrappedSession -> Borrow Session
invalid = coerce
