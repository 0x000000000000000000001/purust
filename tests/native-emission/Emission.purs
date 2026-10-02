module Test.Emission where

import Prelude
import Data.Array as Array
import Data.Either (Either(..))
import Data.Foldable (traverse_)
import Effect (Effect)
import Effect.Aff (Aff, attempt, bracket, delay, launchAff_, throwError)
import Effect.Class (liftEffect)
import Effect.Console (log)
import Effect.Exception (error)
import Effect.Ref as Ref
import Data.Time.Duration (Milliseconds(..))
import Purust.Emission (withEmitter)

check :: Boolean -> String -> Aff Unit
check condition message = unless condition (throwError (error message))

scenario :: Int -> String -> Aff Unit
scenario jobs failure = do
  active <- liftEffect (Ref.new 0)
  peak <- liftEffect (Ref.new 0)
  published <- liftEffect (Ref.new [])
  let
    generate n = bracket
      (liftEffect do
        running <- Ref.modify (_ + 1) active
        Ref.modify_ (max running) peak)
      (\_ -> liftEffect (Ref.modify_ (_ - 1) active))
      (\_ -> do
        delay (Milliseconds (if n `mod` 3 == 0 then 20.0 else 5.0))
        when (failure == "generate" && n == 2) (throwError (error "generate"))
        pure n)
    publish n = do
      when (failure == "publish" && n == 2) (throwError (error "publish"))
      liftEffect (Ref.modify_ (flip Array.snoc n) published)
    produce enqueue = do
      traverse_ enqueue (Array.range 0 8)
      when (failure == "produce") (throwError (error "produce"))
  result <- attempt (withEmitter jobs generate publish produce)
  running <- liftEffect (Ref.read active)
  maximum <- liftEffect (Ref.read peak)
  values <- liftEffect (Ref.read published)
  check (running == 0) "a generation worker survived completion"
  check (maximum <= jobs) "generation concurrency limit exceeded"
  check (values == Array.take (Array.length values) (Array.range 0 8)) "publication order changed"
  case result, failure of
    Right _, "" -> do
      check (values == Array.range 0 8) "final results were not drained"
      check (maximum == jobs) "generation did not overlap"
    Left _, "generate" -> check (values == [0, 1]) "generator failure publication point"
    Left _, "publish" -> check (values == [0, 1]) "publisher failure publication point"
    Left _, "produce" -> pure unit
    _, _ -> throwError (error "unexpected success/failure")

main :: Effect Unit
main = launchAff_ do
  traverse_ (\jobs -> traverse_ (scenario jobs) ["", "generate", "publish", "produce"]) [1, 2, 4]
  liftEffect (log "EMISSION_NATIVE_OK 12 scenarios")
