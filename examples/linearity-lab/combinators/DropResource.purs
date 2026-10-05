module LinearLab.Combinators.DropResource where
import Data.Unit (Unit)
import LinearLab.Combinators.Linear as L
invalid :: L.Linear L.Session Unit
invalid = L.identity
