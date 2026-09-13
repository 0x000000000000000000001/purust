module VariantPublicProbe where

import Prelude
import Data.Maybe (Maybe(..))
import Data.Variant as V
import Type.Proxy (Proxy(..))
import Unsafe.Coerce (unsafeCoerce)

type Choice = V.Variant (integer :: Int, text :: String)

integer :: Int -> Choice
integer = V.inj (Proxy :: Proxy "integer")

text :: String -> Choice
text = V.inj (Proxy :: Proxy "text")

openInteger :: forall r. Int -> V.Variant (integer :: Int | r)
openInteger = V.inj (Proxy :: Proxy "integer")

describe :: Choice -> String
describe = V.match { integer: \n -> "int:" <> show n, text: \s -> "text:" <> s }

project :: Choice -> Int
project v = case V.prj (Proxy :: Proxy "integer") v of
  Just n -> n
  Nothing -> -999

onlyInteger :: (Int -> String) -> Choice -> String
onlyInteger f = V.on (Proxy :: Proxy "integer") f (const "skip")

increment :: Choice -> Choice
increment = V.over { integer: \n -> n + 1 }

expanded :: Int -> Choice
expanded n = V.expand (openInteger n :: V.Variant (integer :: Int))

contracted :: Choice -> Int
contracted v = case V.contract v :: Maybe (V.Variant (integer :: Int)) of
  Just x -> V.on (Proxy :: Proxy "integer") identity V.case_ x
  Nothing -> -999

equal :: Choice -> Choice -> Boolean
equal = eq

order :: Choice -> Choice -> Ordering
order = compare

display :: Choice -> String
display = show

roundtrip :: Choice -> Choice
roundtrip = V.revariant <<< V.unvariant

generic :: forall a. a -> V.Variant (payload :: a)
generic = V.inj (Proxy :: Proxy "payload")

rejectUnknown :: Unit -> String
rejectUnknown _ = V.case_ (unsafeCoerce { type: "missing", value: 0 })
