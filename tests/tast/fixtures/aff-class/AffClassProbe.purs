module AffClassProbe where

import Effect (Effect)
import Effect.Aff (Aff)
import Effect.Aff.Class (class MonadAff, liftAff)
import Effect.Class (liftEffect)

viaAff :: forall m a. MonadAff m => Aff a -> m a
viaAff = liftAff

viaEffect :: forall m a. MonadAff m => Effect a -> m a
viaEffect = liftEffect
