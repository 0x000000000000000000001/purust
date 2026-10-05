module LinearLab.Indexed.CoerceState where
import Prelude (Unit)
import LinearLab.Indexed.Api (Ix, State)
import Safe.Coerce (coerce)
bad :: forall scope a.
  Ix scope (State () ()) (State (resource :: Unit) (resource :: Unit)) a ->
  Ix scope (State () ()) (State (resource :: Unit) ()) a
bad = coerce
