module LinearLab.Lowering.ScalarCopy where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial = S.sum (S.duplicate initial)
