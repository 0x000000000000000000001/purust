module EnumConsumer where

import EnumTypes (Color(..), Tree(..))

foreign import flipColor :: Color -> Color
foreign import passThrough :: forall a. a -> a
foreign import missingColor :: Color -> Color

black :: Color
black = B

make :: Color -> Tree -> Int -> Tree -> Tree
make color left key right = T color left key right

colorOf :: Tree -> Color
colorOf E = R
colorOf (T color _ _ _) = color

isRed :: Color -> Boolean
isRed R = true
isRed B = false

roundTrip :: Color -> Color
roundTrip color = passThrough color

throughFfi :: Color -> Color
throughFfi color = flipColor color
