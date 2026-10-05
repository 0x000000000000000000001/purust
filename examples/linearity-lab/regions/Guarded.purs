module LinearLab.Regions.Guarded (Handle, open, inspect, finish, withBorrow, race, assertEqual, verify) where

import Prelude
import Effect (Effect)

-- Handles are ordinary unrestricted values; consuming operations are checked.
-- This small diagnostic ABI uses -1 for consumed, -2 for busy, -3 for poisoned.
-- Successful resource values in the demo are non-negative.
foreign import data Handle :: Type
foreign import open :: Int -> Effect Handle
foreign import inspect :: Handle -> Effect Int
foreign import finish :: Handle -> Effect Int
foreign import withBorrow :: Handle -> Effect Int -> Effect Int
foreign import race :: Handle -> Effect Int
foreign import assertEqual :: Int -> Int -> Effect Unit
foreign import verify :: Effect Unit
