module LinearLab.Combinators.AliasArrow where
import LinearLab.Combinators.Linear as L
allowed :: L.Linear (L.Pair L.Session L.Session) (L.Pair Int Int)
allowed = let alias = L.finish in L.tensor alias alias
