module ListPipelineConsumer where

import ListPipeline (List, sumEvens, sumEvensFrom, productEvens, sumAll, diffEvens, filteredOdds, mapDouble)

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

runFilteredOdds :: Int -> List Int
runFilteredOdds = filteredOdds

runMapDouble :: List Int -> List Int
runMapDouble = mapDouble
