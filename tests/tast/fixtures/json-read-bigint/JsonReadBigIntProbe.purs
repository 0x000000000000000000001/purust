module JsonReadBigIntProbe where

import Prelude

import Foreign (Foreign)
import JS.BigInt (BigInt)
import Yoga.JSON (E)
import Yoga.JSON as JSON

readNative :: Foreign -> E BigInt
readNative = JSON.read

readField :: String -> E BigInt
readField payload = map _.big (JSON.readJSON payload :: E { big :: BigInt })

readFields :: String -> E (Array BigInt)
readFields payload = map (map _.big) (JSON.readJSON payload :: E (Array { big :: BigInt }))
