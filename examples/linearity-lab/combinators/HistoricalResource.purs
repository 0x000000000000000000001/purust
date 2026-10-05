module LinearLab.Combinators.HistoricalResource (Session, open, finish) where
import LinearLab.Combinators.Historical (Sub)
data Session
foreign import open :: Sub Int Session
foreign import finish :: Sub Session Int
