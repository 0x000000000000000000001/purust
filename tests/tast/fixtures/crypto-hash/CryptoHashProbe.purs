module CryptoHashProbe where

import Prelude

import Effect (Effect)
import Effect.Aff (launchAff_)
import Effect.Class (liftEffect)
import Util.Crypto.Hash as Hash

run :: String -> (String -> Effect Unit) -> Effect Unit
run input complete = launchAff_ do
  value <- Hash.xxhash64 input
  liftEffect $ complete value
