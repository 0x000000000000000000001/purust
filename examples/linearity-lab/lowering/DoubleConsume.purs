module LinearLab.Lowering.DoubleConsume where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let
    session = S.open initial
    alias = session
  in S.sum (S.Pair (S.finish session) (S.finish alias))
