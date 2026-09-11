module PipesXProbe where

import Pipes.Internal as Pipes
import Unsafe.Coerce (unsafeCoerce)

select :: forall a. (Pipes.X -> a) -> a -> a
select _ value = value

keepClosed :: forall a. a -> a
keepClosed = select Pipes.closed

closedInt :: Pipes.X -> Int
closedInt = Pipes.closed

rewrap :: Pipes.X -> Pipes.X
rewrap value = Pipes.X value

-- A foreign caller can break the source contract; the runtime must reject it.
invalid :: Int -> Pipes.X
invalid = unsafeCoerce

opaqueClosed :: forall a. a
opaqueClosed = unsafeCoerce Pipes.closed

data X = Payload Int

readPayload :: X -> Int
readPayload (Payload n) = n

newtype Count = Count Int

readCount :: Count -> Int
readCount (Count n) = n
