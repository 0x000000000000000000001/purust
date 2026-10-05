module LinearLab.Combinators.DoubleFinish where
import LinearLab.Combinators.Linear as L
invalid = L.then_ L.finish L.finish
