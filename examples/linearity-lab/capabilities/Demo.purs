module LinearLab.Capabilities.Demo where

import Prelude (Unit, (>>>), bind)
import Effect (Effect)
import LinearLab.Capabilities.Sub as S

foreign import verify :: Int -> Int -> Int -> Int -> Int -> Effect Unit

-- Keep the left resource, actually destroy the right one, then finish.
abandon :: S.Sub Int Int
abandon = S.clone >>> S.tensor S.openOwned S.openDisposable >>> S.fst' >>> S.finishOwned

-- The left clone is mutated. The right copy must keep its initial contents.
deep :: S.Sub Int Int
deep = S.openDeep >>> S.twice (S.tensor (S.addDeep 7 >>> S.finishDeep) S.finishDeep) >>> S.sumInts

-- Two aliases to one immutable native payload, not two independent resources.
shared :: S.Sub Int Int
shared = S.openShared >>> S.share >>> S.tensor S.finishShared S.identity >>> S.fst'

discardPair :: S.Sub Int Int
discardPair = S.clone >>> S.tensor S.openDisposable S.openDeep >>> S.drop >>> S.zero

main :: Effect Unit
main = do
  let replay = S.runInt abandon 10
  first <- replay
  second <- replay
  copied <- S.runInt deep 10
  aliased <- S.runInt shared 10
  discarded <- S.runInt discardPair 10
  verify first second copied aliased discarded
