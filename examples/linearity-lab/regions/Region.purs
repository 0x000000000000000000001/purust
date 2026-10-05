module LinearLab.Regions.Region (Region, Handle, open, inspect, finish, runRegion) where

import Prelude
import Effect (Effect)

-- ST-shaped API. The constructor and conversion to Effect remain private.
newtype Region scope a = Region (Effect a)
type role Region nominal representational

derive newtype instance functorRegion :: Functor (Region scope)
derive newtype instance applyRegion :: Apply (Region scope)
derive newtype instance applicativeRegion :: Applicative (Region scope)
derive newtype instance bindRegion :: Bind (Region scope)
derive newtype instance monadRegion :: Monad (Region scope)

foreign import data Handle :: Type -> Type
foreign import open :: forall scope. Int -> Region scope (Handle scope)
foreign import inspect :: forall scope. Handle scope -> Region scope Int
foreign import finish :: forall scope. Handle scope -> Region scope Int
foreign import runRegion :: forall a. (forall scope. Region scope a) -> a
