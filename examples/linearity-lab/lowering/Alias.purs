module LinearLab.Lowering.Alias where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let
    session = S.open initial
    alias = session
  in S.finish (S.add 1 alias)
