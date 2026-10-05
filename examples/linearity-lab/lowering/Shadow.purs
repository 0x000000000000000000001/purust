module LinearLab.Lowering.Shadow where

import LinearLab.Lowering.Source as S

program :: Int -> Int
program initial =
  let
    session = S.open initial
    alias = session
  in
    let session = S.add 2 alias
    in S.finish session
