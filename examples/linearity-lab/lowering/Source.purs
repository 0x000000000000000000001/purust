module LinearLab.Lowering.Source (Session, Pair(..), open, add, inspect, observe, read, finish, duplicate, sum) where

-- Specification for the extra compilation experiment, not an executable FFI.
-- These signatures alone do not impose linear usage in ordinary PureScript.
foreign import data Session :: Type
data Pair a b = Pair a b

foreign import open :: Int -> Session
foreign import add :: Int -> Session -> Session
foreign import inspect :: Session -> Session
foreign import observe :: Session -> Pair Session Int
-- Ordinary borrow-shaped signature, deliberately unsupported by the lowering.
foreign import read :: Session -> Int
foreign import finish :: Session -> Int
foreign import duplicate :: Int -> Pair Int Int
foreign import sum :: Pair Int Int -> Int
