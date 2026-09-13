module BigIntProbe where

import Data.Maybe (Maybe(..))
import JS.BigInt (BigInt)

keep :: BigInt -> BigInt
keep value = value

wrap :: BigInt -> Maybe BigInt
wrap value = Just value

unwrap :: BigInt -> Maybe BigInt -> BigInt
unwrap fallback value = case value of
  Nothing -> fallback
  Just found -> found

viaCallback :: (BigInt -> BigInt) -> BigInt -> BigInt
viaCallback callback value = callback value
