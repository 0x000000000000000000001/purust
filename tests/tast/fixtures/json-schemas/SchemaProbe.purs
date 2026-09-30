module SchemaProbe where

import Prelude
import Data.Argonaut.Core (Json, stringify)
import Data.Argonaut.Decode (class DecodeJson, decodeJson, (.:), (.:?))
import Data.Argonaut.Decode.Error (JsonDecodeError(..), printJsonDecodeError)
import Data.Argonaut.Decode.Parser (decodeJsonStringWith)
import Data.Argonaut.Encode (class EncodeJson, encodeJson)
import Data.Either (Either(..))
import Data.Foldable (foldl)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.String.CodeUnits as String
import Effect (Effect)

type Line = { count :: Int, cost :: Number }
data Action = Open String (Maybe Int) | Close Int (Array Line)

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

data Recover = Recover Int
instance decodeRecover :: DecodeJson Recover where
  decodeJson json = case decodeJson json of
    Left _ -> Right (Recover 7)
    Right value -> Right (Recover value)

recover :: Json -> Either JsonDecodeError { item :: Recover }
recover = decodeJson

main :: Effect Unit
main = pure unit
