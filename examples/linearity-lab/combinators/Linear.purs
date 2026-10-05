module LinearLab.Combinators.Linear
  ( Linear, Pair, Session, identity, then_, tensor, swap, assoc, unassoc
  , duplicateInt, sumInts, open, add, inspect, observe, finish, runInt
  ) where

import Effect (Effect)

-- No ordinary PureScript value of either type is made available to clients.
data Session
data Pair :: Type -> Type -> Type
data Pair a b

foreign import data Code :: Type
newtype Linear :: Type -> Type -> Type
newtype Linear a b = Linear Code
type role Linear nominal nominal

foreign import primitive :: Int -> Int -> Code
foreign import sequenceCode :: Code -> Code -> Code
foreign import tensorCode :: Code -> Code -> Code
foreign import runCode :: Code -> Int -> Effect Int

identity :: forall a. Linear a a
identity = Linear (primitive 0 0)

then_ :: forall a b c. Linear a b -> Linear b c -> Linear a c
then_ (Linear left) (Linear right) = Linear (sequenceCode left right)

tensor :: forall a b c d. Linear a b -> Linear c d -> Linear (Pair a c) (Pair b d)
tensor (Linear left) (Linear right) = Linear (tensorCode left right)

swap :: forall a b. Linear (Pair a b) (Pair b a)
swap = Linear (primitive 1 0)

assoc :: forall a b c. Linear (Pair (Pair a b) c) (Pair a (Pair b c))
assoc = Linear (primitive 2 0)

unassoc :: forall a b c. Linear (Pair a (Pair b c)) (Pair (Pair a b) c)
unassoc = Linear (primitive 3 0)

-- Duplication is deliberately available for Int only, never for Session.
duplicateInt :: Linear Int (Pair Int Int)
duplicateInt = Linear (primitive 4 0)

sumInts :: Linear (Pair Int Int) Int
sumInts = Linear (primitive 5 0)

open :: Linear Int Session
open = Linear (primitive 6 0)

add :: Int -> Linear Session Session
add amount = Linear (primitive 7 amount)

-- A native shared borrow returns control of the same owned Session.
inspect :: Linear Session Session
inspect = Linear (primitive 8 0)

-- Return both the owner and a shareable snapshot of a native borrow.
observe :: Linear Session (Pair Session Int)
observe = Linear (primitive 10 0)

finish :: Linear Session Int
finish = Linear (primitive 9 0)

-- Deliberately restricted boundary: no live Session can enter ordinary PS.
runInt :: Linear Int Int -> Int -> Effect Int
runInt (Linear code) = runCode code
