module LinearLab.NativeCallbacks.Callbacks
  ( Once, newOnce, invokeOnce, discardOnce
  , Mutable, newMutable, invokeMutable, closeMutable
  , assertInt, assertDrops, expectError, verify
  ) where

import Prelude
import Data.Either (Either(..))
import Effect (Effect)
import Effect.Exception (message, throw, try)

-- PureScript handles and Effects remain unrestricted. The native wrapper
-- enforces one attempted call, including when its callback throws.
foreign import data Once :: Type
foreign import newOnce :: Int -> Effect Once
foreign import invokeOnce :: Once -> (Int -> Effect Int) -> Effect Int
foreign import discardOnce :: Once -> Effect Unit
foreign import data Mutable :: Type
foreign import newMutable :: Int -> Effect Mutable
foreign import invokeMutable :: Mutable -> Int -> (Int -> Effect Int) -> Effect Int
foreign import closeMutable :: Mutable -> Effect Unit
foreign import assertInt :: String -> Int -> Int -> Effect Unit
foreign import assertDrops :: String -> Int -> Effect Unit
foreign import verify :: Effect Unit

expectError :: String -> Effect Int -> Effect Unit
expectError expected action = do
  result <- try action
  case result of
    Left failure -> unless (message failure == expected) $ throw ("Wrong failure: " <> message failure)
    Right _ -> throw ("Missing expected failure: " <> expected)
