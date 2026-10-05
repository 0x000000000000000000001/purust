module LinearLab.Combinators.EscapeResource where
import Effect (Effect)
import LinearLab.Combinators.Linear as L
invalid :: Effect L.Session
invalid = L.runInt L.open 0
