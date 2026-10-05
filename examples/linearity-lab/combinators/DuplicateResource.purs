module LinearLab.Combinators.DuplicateResource where
import LinearLab.Combinators.Linear as L
invalid :: L.Linear L.Session (L.Pair L.Session L.Session)
invalid = L.duplicateInt
