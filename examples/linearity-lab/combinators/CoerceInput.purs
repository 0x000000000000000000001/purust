module LinearLab.Combinators.CoerceInput where
import Safe.Coerce (coerce)
import LinearLab.Combinators.Linear as L
invalid :: L.Linear L.Session L.Session
invalid = coerce L.open
