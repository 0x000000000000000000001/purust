module Purust.Emission (withEmitter) where

import Prelude

import Data.Array as Array
import Data.Either (either)
import Data.Maybe (Maybe(..))
import Effect.Aff (Aff, attempt, forkAff, joinFiber, supervise, throwError)
import Effect.Class (liftEffect)
import Effect.Ref as Ref

-- Only the coordinator owns the queue and publishes results. Workers return
-- immutable generated modules; up to `jobs` may be in flight. Joining the
-- oldest result preserves publication order and applies backpressure without
-- an unbounded output buffer. Supervision encloses producer, workers and drain.
withEmitter
  :: forall a b
   . Int
  -> (a -> Aff b)
  -> (b -> Aff Unit)
  -> ((a -> Aff Unit) -> Aff Unit)
  -> Aff Unit
withEmitter jobs generate publish produce = supervise do
  pending <- liftEffect (Ref.new [])
  let
    publishOldest = do
      queued <- liftEffect (Ref.read pending)
      case Array.uncons queued of
        Nothing -> pure unit
        Just { head, tail } -> do
          outcome <- joinFiber head
          liftEffect (Ref.write tail pending)
          value <- either throwError pure outcome
          publish value
    enqueue input
      | jobs <= 1 = generate input >>= publish
      | otherwise = do
          queued <- liftEffect (Ref.read pending)
          when (Array.length queued >= jobs) publishOldest
          -- Keep failure as a result until the coordinator observes it. A
          -- worker must not report an unhandled error before its ordered join.
          fiber <- forkAff (attempt do
            -- Defer construction too: a pure generator may do substantial
            -- work before returning its Aff, or throw while constructing it.
            liftEffect (pure unit)
            generate input)
          liftEffect (Ref.modify_ (flip Array.snoc fiber) pending)
    finish = do
      queued <- liftEffect (Ref.read pending)
      unless (Array.null queued) do
        publishOldest
        finish
  produce enqueue
  finish
