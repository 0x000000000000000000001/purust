module Rotations where

import Prelude

data Color = Red | Black
data Tree = Empty | Node Color Tree Int Tree

rotateRight :: Tree -> Int -> Tree -> Tree
rotateRight (Node _ a x b) y c = Node Red a x (Node Black b y c)
rotateRight Empty y c = Node Black Empty y c

balance :: Color -> Tree -> Int -> Tree -> Tree
balance Black (Node Red (Node Red a x b) y c) z d = Node Red (Node Black a x b) y (Node Black c z d)
balance Black (Node Red a x (Node Red b y c)) z d = Node Red (Node Black a x b) y (Node Black c z d)
balance Black a x (Node Red (Node Red b y c) z d) = Node Red (Node Black a x b) y (Node Black c z d)
balance Black a x (Node Red b y (Node Red c z d)) = Node Red (Node Black a x b) y (Node Black c z d)
balance color a x b = Node color a x b
