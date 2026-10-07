module LinearLab.Capabilities.Sub
  ( Sub, type (-*), Pair, Owned, Disposable, Deep, SharedValue
  , class Clone, clone, class Drop, drop, class Shared
  , identity, tensor, fst', twice, share
  , openOwned, finishOwned, openDisposable, openDeep, addDeep, finishDeep
  , openShared, finishShared, sumInts, zero, runInt
  ) where

import Prelude (class Semigroupoid, Unit, (>>>))
import Effect (Effect)

data Pair :: Type -> Type -> Type
data Pair a b
data Owned
data Disposable
data Deep
data SharedValue

foreign import data Code :: Type
newtype Sub :: Type -> Type -> Type
newtype Sub a b = Sub Code
type role Sub nominal nominal
infixr 4 type Sub as -*

foreign import primitive :: Int -> Int -> Code
foreign import composeCode :: Code -> Code -> Code
foreign import tensorCode :: Code -> Code -> Code
foreign import runCode :: Code -> Int -> Effect Int

instance semigroupoidSub :: Semigroupoid Sub where
  compose (Sub after) (Sub before) = Sub (composeCode before after)

identity :: forall a. Sub a a
identity = Sub (primitive 0 0)

tensor :: forall a b c d. Sub a b -> Sub c d -> Sub (Pair a c) (Pair b d)
tensor (Sub left) (Sub right) = Sub (tensorCode left right)

class Clone a where
  clone :: Sub a (Pair a a)

class Drop a where
  drop :: Sub a Unit

-- Shared is an explicit policy for duplicating access to the SAME immutable
-- value, not a claim that every Rust Clone implementation has this property.
class (Clone a, Drop a) <= Shared a

instance cloneInt :: Clone Int where
  clone = Sub (primitive 1 0)
instance dropInt :: Drop Int where
  drop = Sub (primitive 16 0)
instance sharedInt :: Shared Int
instance dropUnit :: Drop Unit where
  drop = Sub (primitive 17 0)
instance dropDisposable :: Drop Disposable where
  drop = Sub (primitive 6 0)
instance cloneDeep :: Clone Deep where
  clone = Sub (primitive 8 0)
instance dropDeep :: Drop Deep where
  drop = Sub (primitive 9 0)
instance cloneSharedValue :: Clone SharedValue where
  clone = Sub (primitive 13 0)
instance dropSharedValue :: Drop SharedValue where
  drop = Sub (primitive 14 0)
instance sharedSharedValue :: Shared SharedValue

instance dropPair :: (Drop a, Drop b) => Drop (Pair a b) where
  drop = tensor drop drop >>> Sub (primitive 18 0)

-- K-like projection must actually destroy the discarded resource.
fst' :: forall a b. Drop b => Sub (Pair a b) a
fst' = tensor identity drop >>> Sub (primitive 19 0)

-- W-like routing: duplicate only if the input's Clone policy permits it.
twice :: forall a b. Clone a => Sub (Pair a a) b -> Sub a b
twice consumer = clone >>> consumer

share :: forall a. Shared a => Sub a (Pair a a)
share = clone

openOwned :: Sub Int Owned
openOwned = Sub (primitive 3 0)
finishOwned :: Sub Owned Int
finishOwned = Sub (primitive 4 0)
openDisposable :: Sub Int Disposable
openDisposable = Sub (primitive 5 0)
openDeep :: Sub Int Deep
openDeep = Sub (primitive 7 0)
addDeep :: Int -> Sub Deep Deep
addDeep n = Sub (primitive 10 n)
finishDeep :: Sub Deep Int
finishDeep = Sub (primitive 11 0)
openShared :: Sub Int SharedValue
openShared = Sub (primitive 12 0)
finishShared :: Sub SharedValue Int
finishShared = Sub (primitive 15 0)
sumInts :: Sub (Pair Int Int) Int
sumInts = Sub (primitive 2 0)
zero :: Sub Unit Int
zero = Sub (primitive 20 0)

-- Resource instances control internal wiring. Only ordinary integers cross
-- this execution boundary; there is no general eliminator or callback lift.
runInt :: Sub Int Int -> Int -> Effect Int
runInt (Sub code) = runCode code
