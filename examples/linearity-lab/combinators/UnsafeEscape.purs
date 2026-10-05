module LinearLab.Combinators.UnsafeEscape where
import Unsafe.Coerce (unsafeCoerce)
import LinearLab.Combinators.Linear as L
-- Negative control: explicit unsafe code is outside the guarantee.
notSafe :: L.Linear L.Session (L.Pair L.Session L.Session)
notSafe = unsafeCoerce L.duplicateInt
