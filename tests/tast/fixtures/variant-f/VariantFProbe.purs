module VariantFProbe where

import Prelude
import Data.Functor.Variant as V
import Data.Maybe (Maybe(..), maybe)
import Data.Traversable (traverse)
import Type.Proxy (Proxy(..))

sample :: V.VariantF (item :: Maybe) Int
sample = V.inj (Proxy :: Proxy "item") (Just 41)

readValue :: V.VariantF (item :: Maybe) Int -> Int
readValue = V.on (Proxy :: Proxy "item") (maybe 0 identity) V.case_

original :: Int
original = readValue sample

mapped :: Int
mapped = readValue (map (_ + 1) sample)

emptyMapped :: Int
emptyMapped = readValue (map (_ + 1) (V.inj (Proxy :: Proxy "item") Nothing))

changedType :: String
changedType = V.on (Proxy :: Proxy "item") (maybe "empty" identity) V.case_ (map show sample)

recordMapped :: Int
recordMapped = readValue (map (\r -> r.a + 1) (V.inj (Proxy :: Proxy "item") (Just { a: 41 })))

traversed :: Maybe Int
traversed = map readValue (traverse (Just <<< (_ + 1)) sample)
