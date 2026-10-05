module LinearLab.Combinators.HistoricalBorrowEscape where
import Prelude
import Data.Tuple (Tuple)
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: H.Sub Session (Tuple Session (H.Borrow Session))
invalid = H.borrow identity
