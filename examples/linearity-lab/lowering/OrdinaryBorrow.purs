module LinearLab.Lowering.OrdinaryBorrow where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let
    session = S.open initial
    before = S.read session
  in S.sum (S.Pair before (S.finish session))
