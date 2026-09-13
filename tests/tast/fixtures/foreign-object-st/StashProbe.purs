module StashProbe where

import Control.Bind (bind, discard)
import Control.Monad.ST (ST, run)
import Control.Applicative (pure)
import Data.Maybe (Maybe(..))
import Foreign.Object.ST (STObject)
import Foreign.Object.ST as Object

allocate :: forall r. ST r (STObject r Int)
allocate = Object.new

putValue :: forall r. Int -> STObject r Int -> ST r (STObject r Int)
putValue = Object.poke "key"

readValue :: forall r. STObject r Int -> ST r (Maybe Int)
readValue = Object.peek "key"

removeKey :: forall r. STObject r Int -> ST r (STObject r Int)
removeKey = Object.delete "key"

roundTrip :: Int -> Maybe Int
roundTrip value = run do
  object <- Object.new
  _ <- Object.poke "key" value object
  before <- Object.peek "key" object
  _ <- Object.delete "key" object
  after <- Object.peek "key" object
  pure case after of
    Nothing -> before
    Just _ -> Nothing

recordRoundTrip :: Int -> Maybe Int
recordRoundTrip value = run do
  object <- Object.new
  _ <- Object.poke "record" { count: value } object
  result <- Object.peek "record" object
  pure case result of
    Nothing -> Nothing
    Just { count } -> Just count
