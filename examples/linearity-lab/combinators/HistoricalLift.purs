module LinearLab.Combinators.HistoricalLift where
import LinearLab.Combinators.Historical as H
import LinearLab.Combinators.HistoricalResource (Session)
invalid :: H.Sub Session Session
invalid = H.liftShared (\s -> s)
