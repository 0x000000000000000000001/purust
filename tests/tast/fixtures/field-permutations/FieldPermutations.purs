-- @inline FieldPermutations.settle never
-- @inline FieldPermutations.settleMirror never
-- @inline FieldPermutations.duplicate never
-- @inline FieldPermutations.calculate never
module FieldPermutations where

import Prelude

-- Deliberately independent of the benchmark: the key and enum have different
-- field positions, the constructors have different names, and tips carry data.
data Switch = Stable | Ready
data Branch = End | Tip Int | Fork Int Branch Switch Branch

settle :: Int -> Branch -> Switch -> Branch -> Branch
settle z (Fork y (Fork x a Ready b) Ready c) Stable d =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable d)
settle z (Fork x a Ready (Fork y b Ready c)) Stable d =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable d)
settle x a Stable (Fork z (Fork y b Ready c) Ready d) =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable d)
settle x a Stable (Fork y b Ready (Fork z c Ready d)) =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable d)
settle key left mode right = Fork key left mode right

-- The mirrored shape has its own first arm; later alternatives in settle
-- remain on the existing path even when their shape happens to be symmetric.
settleMirror :: Int -> Branch -> Switch -> Branch -> Branch
settleMirror x a Stable (Fork y b Ready (Fork z c Ready d)) =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable d)
settleMirror key left mode right = Fork key left mode right

advanceLeft :: Int -> Branch -> Branch
advanceLeft _ End = End
advanceLeft _ (Tip n) = Tip n
advanceLeft n (Fork key left mode right) =
  if n == 0 then Fork (key + 1) left Ready right
  else settle key (advanceLeft (n - 1) left) mode right

advanceRight :: Int -> Branch -> Branch
advanceRight _ End = End
advanceRight _ (Tip n) = Tip n
advanceRight n (Fork key left mode right) =
  if n == 0 then Fork (key + 1) left Ready right
  else settle key left mode (advanceRight (n - 1) right)

advanceMirror :: Int -> Branch -> Branch
advanceMirror _ End = End
advanceMirror _ (Tip n) = Tip n
advanceMirror n (Fork key left mode right) =
  if n == 0 then Fork (key + 1) left Ready right
  else settleMirror key left mode (advanceMirror (n - 1) right)

-- Reusing a subtree twice is not a permutation of owned fields.
duplicate :: Int -> Branch -> Switch -> Branch -> Branch
duplicate z (Fork y (Fork x a Ready b) Ready c) Stable d =
  Fork y (Fork x a Stable b) Ready (Fork z c Stable c)
duplicate key left mode right = Fork key left mode right

advanceDuplicate :: Int -> Branch -> Branch
advanceDuplicate _ End = End
advanceDuplicate _ (Tip n) = Tip n
advanceDuplicate n (Fork key left mode right) =
  if n == 0 then Fork (key + 1) left Ready right
  else duplicate key (advanceDuplicate (n - 1) left) mode right

-- Arithmetic is an observable computation, not a scalar-field permutation.
calculate :: Int -> Branch -> Switch -> Branch -> Branch
calculate z (Fork y (Fork x a Ready b) Ready c) Stable d =
  Fork (y + 1) (Fork x a Stable b) Ready (Fork z c Stable d)
calculate key left mode right = Fork key left mode right

advanceCalculated :: Int -> Branch -> Branch
advanceCalculated _ End = End
advanceCalculated _ (Tip n) = Tip n
advanceCalculated n (Fork key left mode right) =
  if n == 0 then Fork (key + 1) left Ready right
  else calculate key (advanceCalculated (n - 1) left) mode right

-- The enclosing call graph is open, so callback order and panic behavior must
-- be retained even when the returned child has a matching shape.
throughCallback :: (Branch -> Branch) -> Branch -> Branch
throughCallback _ End = End
throughCallback _ (Tip n) = Tip n
throughCallback f (Fork key left mode right) = settle key (f left) mode right
