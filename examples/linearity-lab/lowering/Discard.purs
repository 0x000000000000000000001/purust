module LinearLab.Lowering.Discard where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let session = S.open initial
  in 0
