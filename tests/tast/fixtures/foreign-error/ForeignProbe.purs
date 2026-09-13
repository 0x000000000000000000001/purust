module ForeignProbe where

import Prelude
import Foreign as F

message :: String -> F.ForeignError
message = F.ForeignError

mismatch :: String -> String -> F.ForeignError
mismatch = F.TypeMismatch

atIndex :: Int -> F.ForeignError -> F.ForeignError
atIndex = F.ErrorAtIndex

atProperty :: String -> F.ForeignError -> F.ForeignError
atProperty = F.ErrorAtProperty

render :: F.ForeignError -> String
render = F.renderForeignError

display :: F.ForeignError -> String
display = show

equal :: F.ForeignError -> F.ForeignError -> Boolean
equal = eq

order :: F.ForeignError -> F.ForeignError -> Ordering
order = compare

tag :: F.ForeignError -> Int
tag (F.ForeignError _) = 0
tag (F.TypeMismatch _ _) = 1
tag (F.ErrorAtIndex _ _) = 2
tag (F.ErrorAtProperty _ _) = 3

polymorphic :: F.ForeignError -> F.ForeignError
polymorphic = identity

throughCallback :: (String -> F.ForeignError) -> String -> F.ForeignError
throughCallback f s = f s

carrier :: F.Foreign -> F.Foreign
carrier = identity

roundInt :: Int -> Int
roundInt x = F.unsafeFromForeign (F.unsafeToForeign x)

roundString :: String -> String
roundString x = F.unsafeFromForeign (F.unsafeToForeign x)
