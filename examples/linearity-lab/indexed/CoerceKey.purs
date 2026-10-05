module LinearLab.Indexed.CoerceKey where
import LinearLab.Indexed.Api (Handle)
import Safe.Coerce (coerce)
bad :: forall scope. Handle scope "first" -> Handle scope "second"
bad = coerce
