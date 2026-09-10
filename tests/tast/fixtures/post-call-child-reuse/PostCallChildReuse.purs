-- @inline PostCallChildReuse.joinNode never
module PostCallChildReuse where

import Prelude

data Mode = Calm | Marked
data Node = Vacant | Branch Mode Node Int Node
data Versions = Versions Node Node

flipMode :: Mode -> Mode
flipMode Calm = Marked
flipMode Marked = Calm

-- These guarded projections inspect the newly computed child at two levels.
-- Each nontrivial branch swaps children; the default keeps all four fields.
joinNode :: Mode -> Node -> Int -> Node -> Node
joinNode mode left@(Branch Marked (Branch Marked _ _ _) _ _) key right =
  Branch mode right (key + 100) left
joinNode mode left key right@(Branch Marked _ _ (Branch Marked _ _ _)) =
  Branch mode right (key + 200) left
joinNode mode left key right = Branch mode left key right

advanceLeft :: Int -> Node -> Node
advanceLeft _ Vacant = Vacant
advanceLeft depth (Branch mode left key right) =
  if depth == 0 then Branch (flipMode mode) left (key + 1) right
  else joinNode mode (advanceLeft (depth - 1) left) key right

advanceRight :: Int -> Node -> Node
advanceRight _ Vacant = Vacant
advanceRight depth (Branch mode left key right) =
  if depth == 0 then Branch (flipMode mode) left (key + 1) right
  else joinNode mode left key (advanceRight (depth - 1) right)

retain :: Int -> Node -> Versions
retain depth node = Versions (advanceLeft depth node) node

-- A callback is outside the closed call graph and must use the ordinary path.
throughCallback :: (Node -> Node) -> Node -> Node
throughCallback _ Vacant = Vacant
throughCallback f (Branch mode left key right) = joinNode mode (f left) key right

-- More than one changed field also remains outside the rule.
bothChildren :: Node -> Node
bothChildren Vacant = Vacant
bothChildren (Branch mode left key right) =
  joinNode mode (advanceLeft 0 left) key (advanceRight 0 right)
