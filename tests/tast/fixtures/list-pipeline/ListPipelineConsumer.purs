module ListPipelineConsumer where

import ListPipeline (sumEvens, sumEvensFrom, productEvens, sumAll, diffEvens)

runEvens :: Int -> Int
runEvens = sumEvens

runEvensFrom :: Int -> Int -> Int
runEvensFrom = sumEvensFrom

runProduct :: Int -> Int
runProduct = productEvens

runAll :: Int -> Int
runAll = sumAll

runDiff :: Int -> Int
runDiff = diffEvens
