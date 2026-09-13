module ObjectProbe where

import Control.Applicative (pure)
import Control.Bind (bind, discard)
import Control.Monad.ST (ST, run)
import Data.Maybe (Maybe(..))
import Foreign.Object (Object)
import Foreign.Object as Object
import Foreign.Object.ST (STObject)
import Foreign.Object.ST as STObject

empty :: Object Int
empty = Object.empty

lookup :: String -> Object Int -> Maybe Int
lookup = Object.lookup

insert :: String -> Int -> Object Int -> Object Int
insert = Object.insert

delete :: String -> Object Int -> Object Int
delete = Object.delete

thaw :: forall r. Object Int -> ST r (STObject r Int)
thaw = Object.thawST

freeze :: forall r. STObject r Int -> ST r (Object Int)
freeze = Object.freezeST

roundTrip :: Int -> Maybe Int
roundTrip value = Object.lookup "key" (Object.insert "key" value Object.empty)

runObject :: Int -> Object Int
runObject value = Object.runST do
  object <- STObject.new
  _ <- STObject.poke "key" value object
  pure object

freezeSnapshot :: Int -> Maybe Int
freezeSnapshot value = run do
  object <- STObject.new
  _ <- STObject.poke "key" value object
  snapshot <- Object.freezeST object
  _ <- STObject.delete "key" object
  pure (Object.lookup "key" snapshot)

recordRoundTrip :: Int -> Maybe Int
recordRoundTrip value = case Object.lookup "record" (Object.insert "record" { count: value } Object.empty) of
  Nothing -> Nothing
  Just { count } -> Just count

arrayRoundTrip :: Int -> Maybe (Array Int)
arrayRoundTrip value = Object.lookup "array" (Object.insert "array" [ value, 0 ] Object.empty)

boolRoundTrip :: Boolean -> Maybe Boolean
boolRoundTrip value = Object.lookup "bool" (Object.insert "bool" value Object.empty)

stringRoundTrip :: String -> Maybe String
stringRoundTrip value = Object.lookup "string" (Object.insert "string" value Object.empty)
