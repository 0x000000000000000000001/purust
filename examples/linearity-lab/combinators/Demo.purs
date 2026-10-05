module LinearLab.Combinators.Demo where

import Prelude
import Effect (Effect)
import LinearLab.Combinators.Linear as L

foreign import verify :: Int -> Int -> Int -> Int -> Effect Unit

pipeline :: L.Linear Int Int
pipeline = L.then_ L.open (L.then_ (L.add 7) (L.then_ L.inspect L.finish))

-- Two separate Sessions, with ownership moved through tensor and swap.
pairPipeline :: L.Linear Int Int
pairPipeline =
  L.then_ L.duplicateInt
    (L.then_ (L.tensor L.open L.open)
      (L.then_ (L.tensor (L.add 1) (L.add 2))
        (L.then_ L.swap (L.then_ (L.tensor L.finish L.finish) L.sumInts))))

-- Exercise generic structural reassociation, preserving every input.
triplePipeline :: L.Linear Int Int
triplePipeline =
  L.then_ L.duplicateInt
    (L.then_ (L.tensor L.duplicateInt L.identity)
      (L.then_ L.assoc
        (L.then_ L.unassoc (L.then_ (L.tensor L.sumInts L.identity) L.sumInts))))

main :: Effect Unit
main = do
  let replay = L.runInt pipeline 10
  first <- replay
  second <- replay
  paired <- L.runInt pairPipeline 10
  triple <- L.runInt triplePipeline 10
  verify first second paired triple
