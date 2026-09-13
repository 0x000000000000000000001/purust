module ModuleInitProbe where

import Control.Bind (bind, discard)
import Control.Applicative (pure)
import Data.Unit (Unit)
import Effect (Effect)
import Effect.Ref (Ref)
import Effect.Ref as Ref
import Effect.Unsafe (unsafePerformEffect)
import ModuleInitProbe.Counter (tick)

shared :: Ref Int
shared = unsafePerformEffect do
  tick
  Ref.new 0

store :: Int -> Effect Unit
store value = Ref.write value shared

load :: Effect Int
load = Ref.read shared

factory :: Int -> Ref Int
factory value = unsafePerformEffect do
  tick
  Ref.new value

action :: Effect (Ref Int)
action = do
  tick
  Ref.new 0

dependent :: Ref Int
dependent = unsafePerformEffect do
  tick
  value <- Ref.read shared
  Ref.new value

native :: Int
native = unsafePerformEffect do
  tick
  pure 42
