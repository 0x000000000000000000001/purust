module NullaryEnums where

data Color = R | B
data Tree = E | T Color Tree Int Tree

data Signal = On | Off
data Token = Token
data Marker (a :: Type) = Marker
data Mixed = Empty | Payload Int
data Uninhabited
