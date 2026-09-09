-- @inline RecordRootMove.bump never
module RecordRootMove where

import Prelude

type Pair = { a :: Int, b :: Int }
type Deep = { a :: Int, b :: { c :: Int, d :: { e :: Int, f :: Int } } }
type WithFunction = { a :: Int, b :: Unit -> Int }
data Payload = Payload (Unit -> Int)
type Payloads = { a :: Payload, b :: Payload }
data Versions = Versions Pair Pair
data Saved = Saved (Int -> Pair)

bump :: Pair -> Pair
bump r = r { a = r.a + 1, b = r.b + 2 }

swap :: Pair -> Pair
swap r = r { a = r.b, b = r.a }

retain :: Pair -> Versions
retain r = Versions (r { a = r.a + 1, b = r.b + 2 }) r

callback :: (Int -> Int) -> (Int -> Int) -> Pair -> Pair
callback first second r = r { a = first r.a, b = second r.b }

fromCall :: (Pair -> Pair) -> Pair -> Pair
fromCall make r = (make r) { a = r.a + 1, b = r.b + 2 }

capture :: WithFunction -> WithFunction
capture r = r { a = r.a + 1, b = \_ -> r.a }

capturedBase :: Pair -> Saved
capturedBase r = Saved (\n -> r { b = r.b + n })

useSaved :: Saved -> Int -> Pair
useSaved (Saved f) n = f n

payloads :: Unit -> Payloads
payloads _ = { a: Payload (\_ -> 1), b: Payload (\_ -> 2) }

callbackPayloads :: (Payload -> Payload) -> (Payload -> Payload) -> Payloads -> Payloads
callbackPayloads first second r = r { a = first r.a, b = second r.b }

openRow :: forall r. { score :: Int | r } -> { score :: Int | r }
openRow r = r { score = r.score + 1 }

updateDeep :: Int -> Deep -> Deep
updateDeep 0 r = r
updateDeep n r = updateDeep (n - 1)
  r { a = r.a + 1
    , b = r.b { c = r.b.c + 2
              , d = r.b.d { e = r.b.d.e + 3, f = r.b.d.f + n `mod` 5 }
              }
    }
