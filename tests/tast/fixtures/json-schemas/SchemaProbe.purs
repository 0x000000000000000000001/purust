module SchemaProbe where

import Prelude
import Data.Argonaut.Core (Json, stringify)
import Data.Argonaut.Decode (class DecodeJson, decodeJson, (.:), (.:?))
import Data.Argonaut.Decode.Error (JsonDecodeError(..), printJsonDecodeError)
import Data.Argonaut.Decode.Parser (decodeJsonStringWith)
import Data.Argonaut.Encode (class EncodeJson, encodeJson)
import Data.Array as Array
import Data.Either (Either(..))
import Data.Foldable (foldl)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.String.CodeUnits as String
import Effect (Effect)

type Line = { count :: Int, cost :: Number }
data Action = Open String (Maybe Int) | Close Int (Array Line)

-- A constructor used as a reusable partial application must keep its capture,
-- while each fully applied constructor owns its fresh arguments.
reusedBuilder :: String -> Array Action
reusedBuilder label =
  let make = opaque (Open label)
  in [ make Nothing, make (Just 7) ]

instance decodeAction :: DecodeJson Action where
  decodeJson json = do
    object <- decodeJson json
    kind <- object .: "kind"
    case kind of
      "open" -> Open <$> object .: "label" <*> object .:? "limit"
      "close" -> Close <$> object .: "code" <*> object .: "lines"
      _ -> Left (TypeMismatch "Action kind")

instance encodeAction :: EncodeJson Action where
  encodeJson = case _ of
    Open label limit -> encodeJson { kind: "open", label, limit }
    Close code lines -> encodeJson { kind: "close", code, lines }

type Document = { actions :: Array Action, active :: Boolean, note :: Maybe String }

decode :: Json -> Either JsonDecodeError Document
decode = decodeJson

decodeText :: String -> Either JsonDecodeError Document
decodeText = decodeJsonStringWith decode

fingerprint :: Either JsonDecodeError Document -> String
fingerprint = case _ of
  Left error -> stringify (encodeJson { error: printJsonDecodeError error })
  Right value -> stringify (encodeJson { value })

-- An opaque method must remain ordinary even when its result type is a record.
decodeWith :: (Json -> Either JsonDecodeError Document) -> String -> Either JsonDecodeError Document
decodeWith = decodeJsonStringWith

foreign import opaque :: forall a. a -> a

consume :: Document -> Int
consume original =
  let value = opaque original
  in (if value.active then 10000 else 0)
    + String.length (fromMaybe "" value.note)
    + foldl (\n action -> n + case action of
        Open label limit -> String.length label + fromMaybe 0 limit
        Close code lines -> code + foldl (\m line -> m + line.count) 0 lines
      ) 0 value.actions

change :: Document -> Document
change original = (opaque original) { active = false, note = Just "changed" }

data Twice = Twice String String
instance decodeTwice :: DecodeJson Twice where
  decodeJson json = do
    object <- decodeJson json
    first <- object .: "value"
    second <- object .: "value"
    pure (Twice first second)

twice :: Json -> Either JsonDecodeError Twice
twice = decodeJson

data Tagged = Tagged String
instance decodeTagged :: DecodeJson Tagged where
  decodeJson json = do
    object <- decodeJson json
    tag <- object .: "tag"
    if tag == "echo" then pure (Tagged tag)
    else Left (TypeMismatch "Tagged tag")

tagged :: Json -> Either JsonDecodeError Tagged
tagged = decodeJson

taggedText :: String -> Either JsonDecodeError Tagged
taggedText = decodeJsonStringWith tagged

data Recover = Recover Int
instance decodeRecover :: DecodeJson Recover where
  decodeJson json = case decodeJson json of
    Left _ -> Right (Recover 7)
    Right value -> Right (Recover value)

recover :: Json -> Either JsonDecodeError { item :: Recover }
recover = decodeJson

type Arrays =
  { integers :: Array Int, decimals :: Array Number, flags :: Array Boolean
  , names :: Array String, lines :: Array Line, groups :: Array (Array Line)
  }

decodeArrays :: Json -> Either JsonDecodeError Arrays
decodeArrays = decodeJson

decodeArraysText :: String -> Either JsonDecodeError Arrays
decodeArraysText = decodeJsonStringWith decodeArrays

fingerprintArrays :: Either JsonDecodeError Arrays -> String
fingerprintArrays = case _ of
  Left error -> printJsonDecodeError error
  Right value -> stringify (encodeJson { value })

-- Exercise representation-preserving readers and the public operations which
-- build new arrays, including ST thaw/freeze used by updateAt and sorting.
arrayOps :: Arrays -> String
arrayOps original =
  let value = opaque original
      lines = Array.reverse (Array.filter (\line -> line.count > 1) value.lines)
      changed = fromMaybe [] (Array.updateAt 0 { count: 99, cost: 2.0 } lines)
  in stringify (encodeJson
    { changed
    , sorted: Array.sortBy (\a b -> compare a.cost b.cost) value.lines
    , zipped: Array.zipWith (\a b -> a.count + b.count) value.lines (Array.reverse value.lines)
    , sliced: Array.slice 1 3 value.lines
    , flattened: Array.concat value.groups
    , mapped: map (\line -> line.count) value.lines
    , integers: map (_ + 1) value.integers
    , decimals: Array.reverse value.decimals
    , flags: Array.filter identity value.flags
    , names: Array.slice 0 2 value.names
    , equal: value.names == Array.reverse (Array.reverse value.names)
    , original: value.lines
    })

main :: Effect Unit
main = pure unit
