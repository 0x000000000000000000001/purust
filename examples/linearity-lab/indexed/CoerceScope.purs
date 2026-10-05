module LinearLab.Indexed.CoerceScope where
import LinearLab.Indexed.Api (Handle)
import Safe.Coerce (coerce)
bad :: forall first second key. Handle first key -> Handle second key
bad = coerce
