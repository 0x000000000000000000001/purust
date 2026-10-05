module LinearLab.Regions.Rank2 (Handle, withHandle, inspect, finish) where

import Effect (Effect)

-- Static API experiment: rank-2 quantification only, no linear arrow.
foreign import data Handle :: Type -> Type
foreign import withHandle :: forall a. (forall scope. Handle scope -> Effect a) -> Effect a
foreign import inspect :: forall scope. Handle scope -> Effect Int
foreign import finish :: forall scope. Handle scope -> Effect Int
