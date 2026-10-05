module LinearLab.Combinators.HistoricalWrapped (WrappedSession(..), wrap, unwrap) where
import Safe.Coerce (coerce)
import LinearLab.Combinators.HistoricalResource (Session)
newtype WrappedSession = WrappedSession Session
-- Calibration: these underlying types really are representationally equal.
wrap :: Session -> WrappedSession
wrap = coerce
unwrap :: WrappedSession -> Session
unwrap = coerce
