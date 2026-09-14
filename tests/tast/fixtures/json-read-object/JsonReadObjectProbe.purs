module JsonReadObjectProbe where

import Prelude

import Data.Generic.Rep (class Generic)
import Foreign (Foreign, unsafeFromForeign, unsafeToForeign)
import Foreign.Object (Object)
import Foreign.Object as Object
import Yoga.JSON (E, class ReadForeign)
import Yoga.JSON as JSON
import Yoga.JSON.Generics.TaggedSumRep (defaultOptions, genericReadForeignTaggedSum)

data Tagged = RaisedInt Int | RaisedRecord { count :: Int }

derive instance Generic Tagged _

instance ReadForeign Tagged where
  readImpl = genericReadForeignTaggedSum defaultOptions

taggedValue :: Tagged -> Int
taggedValue (RaisedInt n) = n
taggedValue (RaisedRecord value) = value.count

recordForeign :: Int -> Foreign
recordForeign n = unsafeToForeign { type: "RaisedInt", value: unsafeToForeign n }

nestedRecordForeign :: Int -> Foreign
nestedRecordForeign n = unsafeToForeign { first: { count: n }, second: { count: n + 1 } }

orderedRecordForeign :: Int -> Foreign
orderedRecordForeign n = unsafeToForeign { z: n, alpha: n, constructor: n, beta: n }

emptyRecordForeign :: Unit -> Foreign
emptyRecordForeign _ = unsafeToForeign {}

asObject :: Foreign -> Object Foreign
asObject = unsafeFromForeign

roundObject :: Object Foreign -> Object Foreign
roundObject = unsafeFromForeign <<< unsafeToForeign

fromHomogeneous :: { type :: String, value :: String } -> Object String
fromHomogeneous = Object.fromHomogeneous

readObject :: Foreign -> E (Object Foreign)
readObject = JSON.read

readRecordObject :: Int -> E (Object Foreign)
readRecordObject = JSON.read <<< recordForeign

readNestedObjects :: Foreign -> E (Object (Object Foreign))
readNestedObjects = JSON.read

readObjectWithRecord :: Foreign -> E (Object { count :: Int })
readObjectWithRecord = JSON.read

decodeRecord :: Int -> E Tagged
decodeRecord = JSON.read <<< recordForeign

decodeForeign :: Foreign -> E Tagged
decodeForeign = JSON.read

decodeJSON :: String -> E Tagged
decodeJSON = JSON.readJSON

objectJSON :: Object Foreign -> String
objectJSON = JSON.unsafeStringify
