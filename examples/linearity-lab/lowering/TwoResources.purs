module LinearLab.Lowering.TwoResources where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial = case S.duplicate initial of
  S.Pair left right ->
    let
      first = S.open left
      second = S.open right
      one = S.finish (S.add 1 first)
      two = S.finish (S.add 2 second)
    in S.sum (S.Pair two one)
