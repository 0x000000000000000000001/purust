module LinearLab.Lowering.LocalFunction where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let finishLater value = S.finish value
  in finishLater (S.open initial)
