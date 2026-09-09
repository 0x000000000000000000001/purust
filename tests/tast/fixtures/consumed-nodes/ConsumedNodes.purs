module ConsumedNodes where

import Prelude

data Tree = Empty | Node Tree Int Tree
data Versions = Versions Tree Tree

changeRoot :: Int -> Tree -> Tree
changeRoot _ Empty = Empty
changeRoot delta (Node left key right) = Node left (key + delta) right

changeLeft :: Int -> Tree -> Tree
changeLeft _ Empty = Empty
changeLeft delta (Node left key right) = Node (changeRoot delta left) key right

-- The old value is used after reconstruction, inside the PureScript program.
retainOriginal :: Int -> Tree -> Versions
retainOriginal delta tree = Versions (changeRoot delta tree) tree

-- The reconstructed node contains its original version as a child.
nestOriginal :: Tree -> Tree
nestOriginal Empty = Empty
nestOriginal tree@(Node left key _) = Node left (key + 1) tree

-- Each iteration consumes its accumulator, making uniqueness useful throughout.
repeatRoot :: Int -> Int -> Tree -> Tree
repeatRoot 0 _ tree = tree
repeatRoot n delta tree = repeatRoot (n - 1) delta (changeRoot delta tree)
