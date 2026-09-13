module NullableProbe where

import Prelude
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Nullable (Nullable, null, notNull, toMaybe, toNullable)

missing :: Nullable Int
missing = null

intValue :: Int -> Nullable Int
intValue = notNull

decodeInt :: Int -> Nullable Int -> Int
decodeInt fallback value = fromMaybe fallback (toMaybe value)

roundTrip :: Maybe Int -> Maybe Int
roundTrip = toMaybe <<< toNullable

nest :: Nullable Int -> Nullable (Nullable Int)
nest = notNull

decodeNested :: Int -> Nullable (Nullable Int) -> Int
decodeNested fallback value = case toMaybe value of
  Nothing -> fallback
  Just inner -> decodeInt (fallback - 1) inner

roundTripNested :: Maybe (Nullable Int) -> Maybe (Nullable Int)
roundTripNested = toMaybe <<< toNullable

eqInt :: Nullable Int -> Nullable Int -> Boolean
eqInt = eq

compareInt :: Nullable Int -> Nullable Int -> Ordering
compareInt = compare

showInt :: Nullable Int -> String
showInt = show

functionValue :: (Int -> Int) -> Nullable (Int -> Int)
functionValue = notNull

callFunction :: Nullable (Int -> Int) -> Int -> Int
callFunction value x = case toMaybe value of
  Nothing -> -999
  Just f -> f x

recordValue :: { value :: Int } -> Nullable { value :: Int }
recordValue = notNull

replaceRecord :: Nullable { value :: Int } -> Int -> { value :: Int }
replaceRecord value next = case toMaybe value of
  Nothing -> { value: -999 }
  Just record -> record { value = next }

readRecord :: Nullable { value :: Int } -> Int
readRecord value = case toMaybe value of
  Nothing -> -999
  Just record -> record.value
