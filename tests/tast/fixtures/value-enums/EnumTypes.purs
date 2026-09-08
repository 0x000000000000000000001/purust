module EnumTypes where

data Color = R | B
data Tree = E | T Color Tree Int Tree

red :: Color
red = R
