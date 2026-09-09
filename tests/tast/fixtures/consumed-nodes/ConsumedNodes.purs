-- @inline ConsumedNodes.rebuildNode never
-- @inline ConsumedNodes.rebuildBranch never
-- @inline ConsumedNodes.keepLeft never
-- @inline ConsumedNodes.rebuildWithCallback never
-- @inline ConsumedNodes.collide never
module ConsumedNodes where

import Prelude

data Tree = Empty | Node Tree Int Tree
data Versions = Versions Tree Tree
data Deferred = Idle | Deferred Int (Unit -> Int)
-- Generated helpers must qualify Rust's Option instead of using this ADT.
data Option = None | Some Int

changeRoot :: Int -> Tree -> Tree
changeRoot _ Empty = Empty
changeRoot delta (Node left key right) = Node left (key + delta) right

changeLeft :: Int -> Tree -> Tree
changeLeft _ Empty = Empty
changeLeft delta (Node left key right) = Node (changeRoot delta left) key right

rebuildNode :: Tree -> Int -> Tree -> Tree
rebuildNode left key right = Node left (key + 1) right

throughCall :: Tree -> Tree
throughCall Empty = Empty
throughCall (Node left key right) = rebuildNode left key right

rebuildBranch :: Tree -> Int -> Tree -> Tree
rebuildBranch left key right =
  if key < 0 then Node right (-key) left
  else Node left (key + 1) right

throughBranch :: Tree -> Tree
throughBranch Empty = Empty
throughBranch (Node left key right) = rebuildBranch left key right

consumeFields :: (Tree -> Int -> Tree -> Tree) -> Tree -> Tree
consumeFields _ Empty = Empty
consumeFields f (Node left key right) = f left key right

reuseChild :: Tree -> Tree
reuseChild Empty = Empty
reuseChild (Node left key _) = Node (changeRoot 1 left) key left

changeDeferred :: Deferred -> Deferred
changeDeferred Idle = Idle
changeDeferred (Deferred key f) = Deferred key (\u -> f u + key)

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

throughCallChangingLeft :: Tree -> Tree
throughCallChangingLeft Empty = Empty
throughCallChangingLeft (Node left key right) = rebuildNode (changeRoot 1 left) key right

retainThroughCall :: Tree -> Versions
retainThroughCall tree = Versions (throughCall tree) tree

keepLeft :: Tree -> Int -> Tree -> Tree
keepLeft left _ _ = left

returnExisting :: Tree -> Tree
returnExisting Empty = Empty
returnExisting (Node left key right) = keepLeft left key right

rebuildWithCallback :: (Tree -> Tree) -> Tree -> Int -> Tree -> Tree
rebuildWithCallback f left key right = Node (f left) key (f right)

throughCallback :: (Tree -> Tree) -> Tree -> Tree
throughCallback _ Empty = Empty
throughCallback f (Node left key right) = rebuildWithCallback f left key right

collide :: Tree -> Int -> Tree -> Tree
collide left key right = Node left (key + 1) right

-- A source binding with the worker's prospective name must keep its meaning.
collide__purust_reuse :: Int -> Int
collide__purust_reuse x = x + 99

throughCollision :: Tree -> Tree
throughCollision Empty = Empty
throughCollision (Node left key right) = collide left key right
