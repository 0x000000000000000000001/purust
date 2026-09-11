-- Minimal contract from pipes-8.0.0/src/Pipes/Internal.purs, lines 179-182.
-- The full, unchanged package is checked separately by the b8x graph.
module Pipes.Internal where

newtype X = X X

closed :: forall a. X -> a
closed (X x) = closed x
