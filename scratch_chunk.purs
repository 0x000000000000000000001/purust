module Scratch where
import Prelude
import Data.Array as Array

chunkArray :: forall a. Int -> Array a -> Array (Array a)
chunkArray size arr =
  if Array.length arr <= 0 then []
  else [Array.take size arr] <> chunkArray size (Array.drop size arr)
