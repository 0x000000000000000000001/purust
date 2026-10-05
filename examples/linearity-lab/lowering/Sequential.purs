module LinearLab.Lowering.Sequential where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let
    session = S.open initial
    updated = S.add 7 session
    observed = S.inspect updated
  in S.finish observed
