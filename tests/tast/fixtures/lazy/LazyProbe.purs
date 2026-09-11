module LazyProbe where

import Data.Lazy (Lazy, defer, force)

construct :: Int -> Lazy Int
construct value = defer \_ -> value

consume :: Lazy Int -> Int
consume = force

retain :: Lazy Int -> Lazy Int
retain value = value
