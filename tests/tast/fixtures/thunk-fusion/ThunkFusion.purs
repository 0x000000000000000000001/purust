module ThunkFusion where

import Prelude

suspendAdds :: Int -> Int -> (Unit -> Int) -> Unit -> Int
suspendAdds 0 _ acc = acc
suspendAdds n step acc = suspendAdds (n - 1) step (\_ -> acc unit + step)

fusedAdds :: Int -> Int
fusedAdds offset = suspendAdds 1000 2 (\_ -> 7) unit + offset

suspendOrder :: Int -> (Unit -> Int) -> Unit -> Int
suspendOrder 0 acc = acc
suspendOrder n acc = suspendOrder (n - 1) (\_ -> 2 * acc unit + n)

fusedOrder :: Int -> Int
fusedOrder offset = suspendOrder 3 (\_ -> 7) unit + offset

suspendVary :: Int -> Int -> (Unit -> Int) -> Unit -> Int
suspendVary 0 _ acc = acc
suspendVary n step acc = suspendVary (n - 1) (step + n) (\_ -> acc unit + step * n)

fusedVary :: Int -> Int
fusedVary offset = suspendVary 3 2 (\_ -> 7) unit + offset

fusedZero :: Int -> Int
fusedZero offset = suspendAdds 0 2 (\_ -> 7) unit + offset

upperBoundary :: Unit -> Int
upperBoundary _ = suspendAdds 1 1 (\_ -> 2147483646) unit

lowerBoundary :: Unit -> Int
lowerBoundary _ = suspendAdds 1 (-1) (\_ -> -2147483647) unit

unknownInputs :: Int -> Int -> Int
unknownInputs n seed = suspendAdds n 2 (\_ -> seed) unit

opaqueSeed :: Int -> (Unit -> Int) -> Int
opaqueSeed n seed = suspendAdds n 2 seed unit

savedThunk :: (Unit -> Int) -> Unit -> Int
savedThunk seed = suspendAdds 17 2 seed

suspendTwice :: Int -> (Unit -> Int) -> Unit -> Int
suspendTwice 0 acc = acc
suspendTwice n acc = suspendTwice (n - 1) (\_ -> acc unit + acc unit)

twice :: (Unit -> Int) -> Int
twice seed = suspendTwice 3 seed unit

suspendOverwrite :: Int -> (Unit -> Int) -> Unit -> Int
suspendOverwrite 0 acc = acc
suspendOverwrite n _ = suspendOverwrite (n - 1) (\_ -> n)

overwrite :: (Unit -> Int) -> Int
overwrite seed = suspendOverwrite 3 seed unit

suspendConditional :: Int -> (Unit -> Int) -> Unit -> Int
suspendConditional 0 acc = acc
suspendConditional n acc = suspendConditional (n - 1) (\_ -> if n == 2 then n else acc unit + 1)

conditional :: (Unit -> Int) -> Int
conditional seed = suspendConditional 3 seed unit

outsideIntRange :: Int -> Int
outsideIntRange offset = suspendAdds 2 2147483647 (\_ -> 0) unit + offset

overBudget :: Int -> Int
overBudget offset = suspendAdds 5000 1 (\_ -> 0) unit + offset

negativeDepth :: Int -> Int
negativeDepth offset = suspendAdds (-1) 1 (\_ -> 0) unit + offset
