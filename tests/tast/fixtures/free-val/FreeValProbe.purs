-- Mirrors Control.Applicative.Free (freeap): a foreign data type with no Rust
-- FFI binding carries heterogeneous values through unsafeCoerce. Such a type
-- must become the boxed runtime Value at use sites, not Rc<Val>, or the
-- generated downcasts panic with "Expected Class".
module FreeValProbe where

import Unsafe.Coerce (unsafeCoerce)

foreign import data Val :: Type

toVal :: forall a. a -> Val
toVal = unsafeCoerce

fromVal :: forall a. Val -> a
fromVal = unsafeCoerce

-- A constructor field of the opaque type.
data Box = Box Val

box :: forall a. a -> Box
box value = Box (toVal value)

unboxInt :: Box -> Int
unboxInt (Box value) = fromVal value

-- A free-applicative-like node whose opaque fields are extracted by pattern
-- matching, as foldFreeAp does.
data FreeAp = Pure Int | Ap Val Val

pairFreeAp :: Int -> Int -> FreeAp
pairFreeAp left right = Ap (toVal left) (toVal right)

outPair :: FreeAp -> { left :: Int, right :: Int }
outPair = case _ of
  Pure value -> { left: value, right: value }
  Ap left right -> { left: fromVal left, right: fromVal right }

-- Records and functions cross the carrier unchanged.
boxRecord :: { count :: Int } -> Val
boxRecord = toVal

readCount :: Val -> Int
readCount value = (fromVal value :: { count :: Int }).count

recordCount :: Int
recordCount = readCount (boxRecord { count: 42 })

boxedFunction :: Val
boxedFunction = toVal (\_ -> 42)

applyBoxed :: Int -> Int
applyBoxed = fromVal boxedFunction

roundTrip :: Int
roundTrip = unboxInt (box 41)

pairedLeft :: Int
pairedLeft = (outPair (pairFreeAp 7 9)).left

pairedRight :: Int
pairedRight = (outPair (pairFreeAp 7 9)).right

applied :: Int
applied = applyBoxed 0
