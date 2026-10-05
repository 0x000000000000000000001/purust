module LinearLab.Lowering.Observed where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial = case S.observe (S.open initial) of
  S.Pair session before -> case S.observe (S.add 3 session) of
    S.Pair changed after ->
      S.sum (S.Pair before (S.sum (S.Pair after (S.finish changed))))
