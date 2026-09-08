module PolyLoop where

import Prelude
import Partial.Unsafe (unsafePartial)

data Box a = Empty | Present a

fromPresent :: forall a. Partial => Box a -> a
fromPresent (Present value) = value

-- The compiler inserts a synthetic dictionary application into this partial
-- pattern match. Its result must not retain the consumed Partial constraint.
partialComposed :: Box Int -> Int
partialComposed = unsafePartial (fromPresent <<< identity)

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
