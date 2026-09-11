module FreeMonadRecProbe where

import Prelude

import Control.Monad.Free (Free, liftF, runFree)
import Control.Monad.Rec.Class (Step(..), tailRecM)
import Data.Identity (Identity(..))

drive :: forall a b. (a -> Free Identity (Step a b)) -> a -> Free Identity b
drive = tailRecM

fromStep :: forall a b. Step a b -> Free Identity (Step a b)
fromStep = pure

run :: forall a. Free Identity a -> a
run = runFree (\(Identity next) -> next)

count :: Int -> Int
count limit = run (drive step 0)
  where
  step n = pure (if n < limit then Loop (n + 1) else Done n)

suspended :: Int -> Int
suspended limit = run (drive step 0)
  where
  step n = liftF (Identity (if n < limit then Loop (n + 1) else Done n))

payload :: forall a. a -> Free Identity a
payload value = drive (\_ -> pure (Done value)) unit
