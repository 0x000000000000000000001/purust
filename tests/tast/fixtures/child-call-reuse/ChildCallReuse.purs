-- @inline ChildCallReuse.joinNode never
module ChildCallReuse where

import Prelude

data Flag = Keep | Turn
data Tree = Tip | Fork Flag Tree Int Tree
data Versions = Versions Tree Tree

foreign import checkedKey :: Int -> Int

-- The other branch changes the shape and must keep the ordinary helper path.
joinNode :: Flag -> Tree -> Int -> Tree -> Tree
joinNode flag left key right = case flag of
  Turn -> Fork Turn right (key + 1) left
  _ -> Fork flag left key right

walkLeft :: Int -> Tree -> Tree
walkLeft _ Tip = Tip
walkLeft n (Fork flag left key right) =
  if n == 0 then Fork flag left (key + 1) right
  else joinNode flag (walkLeft (n - 1) left) key right

walkRight :: Int -> Tree -> Tree
walkRight _ Tip = Tip
walkRight n (Fork flag left key right) =
  if n == 0 then Fork flag left (key + 1) right
  else joinNode flag left key (walkRight (n - 1) right)

-- A native local call is insufficient: this recursion reaches foreign code.
walkChecked :: Int -> Tree -> Tree
walkChecked _ Tip = Tip
walkChecked n (Fork flag left key right) =
  if n == 0 then Fork flag left (checkedKey key) right
  else joinNode flag (walkChecked (n - 1) left) key right

retain :: Int -> Tree -> Versions
retain n tree = Versions (walkLeft n tree) tree

throughCallback :: (Tree -> Tree) -> Tree -> Tree
throughCallback _ Tip = Tip
throughCallback f (Fork flag left key right) = joinNode flag (f left) key right

-- Two changed fields remain outside the single-child update rule. Their calls
-- still have to execute once, from left to right, including when one unwinds.
ordered :: (Tree -> Tree) -> (Int -> Int) -> Tree -> Tree
ordered _ _ Tip = Tip
ordered child keyFn (Fork flag left key right) =
  joinNode flag (child left) (keyFn key) right

bothChildren :: Tree -> Tree
bothChildren Tip = Tip
bothChildren (Fork flag left key right) =
  joinNode flag (walkLeft 0 left) key (walkRight 0 right)

-- Retaining an old child in a different field rules out consuming it in place.
aliasChild :: Tree -> Tree
aliasChild Tip = Tip
aliasChild (Fork flag left key _) = joinNode flag (walkLeft 0 left) key left
