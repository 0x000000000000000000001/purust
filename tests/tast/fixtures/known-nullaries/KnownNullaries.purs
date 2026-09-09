module KnownNullaries where

import Prelude
import OtherNullaries as Other

data Tree = Empty | End | Node Tree Int Tree
data Mixed = Mixed Tree Other.Other Tree Other.Other

seeded :: Tree -> Int -> Tree
seeded Empty k = Node Empty k Empty
seeded tree _ = tree

nested :: Tree -> Int -> Tree
nested Empty k = Node Empty k (Node Empty (k + 1) Empty)
nested tree _ = tree

mixed :: Tree -> Mixed
mixed Empty = Mixed Empty Other.Empty Empty Other.Empty
mixed tree = Mixed tree Other.Empty tree Other.Empty

different :: Tree -> Int -> Tree
different Empty k = Node End k End
different tree _ = tree

withFactory :: Tree -> (Int -> Tree) -> Int -> Tree
withFactory Empty f k = Node (f k) k Empty
withFactory tree _ _ = tree

callTest :: (Int -> Tree) -> Int -> Tree
callTest f k = case f k of
  Empty -> Node Empty k Empty
  _ -> End

thenUse :: Tree -> Int -> (Tree -> Tree -> Tree) -> Tree
thenUse tree k f = f (seeded tree k) tree
