-- @inline FieldUpdates.paint never
module FieldUpdates where

data Shade = Red | Black
data Tree = Empty | Branch Shade Tree Int Tree
data Versions = Versions Tree Tree
data Solid = Solid Shade Int
-- Names must not capture Rust's qualified Option constructors.
data Option = None | Some Int

blacken :: Tree -> Tree
blacken Empty = Empty
blacken (Branch _ left key right) = Branch Black left key right

paint :: Shade -> Tree -> Tree
paint _ Empty = Empty
paint shade (Branch _ left key right) = Branch shade left key right

setKey :: Int -> Tree -> Tree
setKey _ Empty = Empty
setKey key (Branch shade left _ right) = Branch shade left key right

paintSolid :: Shade -> Solid -> Solid
paintSolid shade (Solid _ key) = Solid shade key

retain :: Shade -> Tree -> Versions
retain shade tree = Versions (paint shade tree) tree

swapChildren :: Tree -> Tree
swapChildren Empty = Empty
swapChildren (Branch shade left key right) = Branch shade right key left

both :: Shade -> Int -> Tree -> Tree
both _ _ Empty = Empty
both shade key (Branch _ left _ right) = Branch shade left key right

viaCall :: (Shade -> Shade) -> Tree -> Tree
viaCall _ Empty = Empty
viaCall f (Branch shade left key right) = Branch (f shade) left key right

replaceChild :: Tree -> Tree -> Tree
replaceChild _ Empty = Empty
replaceChild child (Branch shade _ key right) = Branch shade child key right

nestOriginal :: Tree -> Tree
nestOriginal Empty = Empty
nestOriginal tree@(Branch shade left key _) = Branch shade left key tree
