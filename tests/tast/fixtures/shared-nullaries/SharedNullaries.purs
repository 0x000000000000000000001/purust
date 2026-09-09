module SharedNullaries where

import Prelude
import OtherNullaries as Other

data Tree = Empty | End | Node Tree Int Tree
data Bundle = Bundle Tree Tree Tree Tree
data Mixed = Mixed Tree Other.Other Tree Other.Other

leaf :: Int -> Tree
leaf k = Node Empty k Empty

nested :: Int -> Bundle
nested k = Bundle Empty (leaf k) Empty End

mixed :: Mixed
mixed = Mixed Empty Other.Empty Empty Other.Empty

changeRoot :: Tree -> Tree
changeRoot (Node l k r) = Node l (k + 1) r
changeRoot other = other

fromFactory :: (Int -> Tree) -> Int -> Tree
fromFactory f k = Node (f k) k (f (k + 1))
