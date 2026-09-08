module PolyLoop where

import Prelude

class Monoidish a where
  mempty_ :: a
  mappend_ :: a -> a -> a

instance intMonoidish :: Monoidish Int where
  mempty_ = 1
  mappend_ x y = x + y

instance numberMonoidish :: Monoidish Number where
  mempty_ = 0.5
  mappend_ x y = x + y

polyLoop :: forall a. Monoidish a => Int -> a -> a
polyLoop n0 initial = go n0 initial
  where
  go 0 acc = acc
  go n acc = go (n - 1) (mappend_ acc mempty_)

-- Two quantifiers and a function argument exercise type argument order.
repeatWith :: forall a b. (a -> b -> a) -> b -> Int -> a -> a
repeatWith step delta n0 initial = go n0 initial
  where
  go 0 acc = acc
  go n acc = go (n - 1) (step acc delta)
