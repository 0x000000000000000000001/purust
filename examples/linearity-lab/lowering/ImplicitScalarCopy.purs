module LinearLab.Lowering.ImplicitScalarCopy where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial = S.sum (S.Pair initial initial)
