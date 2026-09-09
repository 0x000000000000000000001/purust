-- @inline RecordRootMove.bump never
module RecordRootMove where

import Prelude

type Pair = { a :: Int, b :: Int }
type Deep = { a :: Int, b :: { c :: Int, d :: { e :: Int, f :: Int } } }
type Nested = { a :: Int, b :: { c :: Int, d :: Int } }
type NestedFunction = { a :: Int, b :: { c :: Int, d :: Unit -> Int } }
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

callbackNested :: (Int -> Int) -> (Int -> Int) -> (Int -> Int) -> Nested -> Nested
callbackNested first second third r =
  r { a = first r.a, b = r.b { c = second r.b.c, d = third r.b.d } }

captureChild :: NestedFunction -> NestedFunction
captureChild r = r { b = r.b { c = r.b.c + 1, d = \_ -> r.b.c } }

nestedPayloads :: Unit -> { a :: Int, b :: { c :: Payload, d :: Payload } }
nestedPayloads _ = { a: 0, b: { c: Payload (\_ -> 1), d: Payload (\_ -> 2) } }

callbackNestedPayloads :: (Payload -> Payload) -> (Payload -> Payload)
  -> { a :: Int, b :: { c :: Payload, d :: Payload } }
  -> { a :: Int, b :: { c :: Payload, d :: Payload } }
callbackNestedPayloads first second r = r { b = r.b { c = first r.b.c, d = second r.b.d } }

callbackDeep :: (Int -> Int) -> (Int -> Int) -> (Int -> Int) -> (Int -> Int) -> Deep -> Deep
callbackDeep first second third fourth r =
  r { a = first r.a
    , b = r.b { c = second r.b.c
              , d = r.b.d { e = third r.b.d.e, f = fourth r.b.d.f }
              }
    }

captureLeaf :: { a :: Int, b :: { c :: Int, d :: { e :: Int, f :: Unit -> Int } } }
  -> { a :: Int, b :: { c :: Int, d :: { e :: Int, f :: Unit -> Int } } }
captureLeaf r = r { b = r.b { d = r.b.d { e = r.b.d.e + 1, f = \_ -> r.b.d.e } } }

deepPayloads :: Unit -> { a :: Int, b :: { c :: Int, d :: { e :: Payload, f :: Payload } } }
deepPayloads _ = { a: 0, b: { c: 0, d: { e: Payload (\_ -> 1), f: Payload (\_ -> 2) } } }

callbackDeepPayloads :: (Payload -> Payload) -> (Payload -> Payload)
  -> { a :: Int, b :: { c :: Int, d :: { e :: Payload, f :: Payload } } }
  -> { a :: Int, b :: { c :: Int, d :: { e :: Payload, f :: Payload } } }
callbackDeepPayloads first second r =
  r { b = r.b { d = r.b.d { e = first r.b.d.e, f = second r.b.d.f } } }

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
