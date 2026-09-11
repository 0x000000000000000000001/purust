module RecordSetProbe where

import Prelude

import Data.Either (Either(..))
import Data.Maybe (Maybe(..))
import Data.Time.Duration (Milliseconds(..))
import Effect.Exception (error)
import Record.Unsafe (unsafeSet)
import Test.Spec.Result (Result(..))
import Test.Spec.Speed (Speed(..))
import Test.Spec.Summary (Summary(..), summarize)
import Test.Spec.Tree (Tree(..))

type Counts = { failed :: Int, passed :: Int, pending :: Int }

zeroCounts :: Counts
zeroCounts = zero

addCounts :: Counts -> Counts -> Counts
addCounts left right = left + right

replacePassed :: Int -> Counts -> Counts
replacePassed = unsafeSet "passed"

addPassed :: Int -> { failed :: Int, pending :: Int } -> Counts
addPassed = unsafeSet "passed"

partialCounts :: Int -> Int -> { failed :: Int, pending :: Int }
partialCounts failed pending = { failed, pending }

readPassed :: Counts -> Int
readPassed counts = counts.passed

ordinaryUpdate :: Int -> Counts -> Counts
ordinaryUpdate value counts = counts { passed = value }

emptySummary :: Counts
emptySummary = case summarize ([] :: Array (Tree String String Result)) of
  Count counts -> counts

mixedSummary :: Counts
mixedSummary = case summarize
  [ Leaf "passed" (Just (Success Fast (Milliseconds 1.0)))
  , Leaf "failed" (Just (Failure (error "expected")))
  , Leaf "pending" Nothing
  , Node (Left "nested" :: Either String String)
      [ Leaf "also passed" (Just (Success Fast (Milliseconds 2.0))) ]
  ] of
  Count counts -> counts
