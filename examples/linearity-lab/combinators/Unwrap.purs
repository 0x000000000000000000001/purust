module LinearLab.Combinators.Unwrap where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Linear as L
invalid :: L.Linear L.Session Int -> L.Session -> Int
invalid = coerce
