module Purust.Build (buildModulesWithJobs) where

import Prelude

import Data.Either (either)
import Data.List (List)
import Data.Maybe (Maybe(..))
import Effect (Effect)
import Effect.Aff (Aff, attempt, forkAff, supervise, throwError)
import Effect.Aff.AVar as AVar
import Effect.Class (liftEffect)
import Effect.Console as Console
import PureScript.Backend.Optimizer.Builder (BuildOptions, buildModules, buildModulesParallel)
import PureScript.Backend.Optimizer.CoreFn (Ann, Module)

foreign import optimizerConcurrency :: Effect Int

-- PBO owns ranked visibility and ordered publication. Code generation stays on
-- its coordinator: Purust's current codegen state is not shared across workers.
-- Supervision also joins workers suspended on publication when a sibling fails.
buildModulesWithJobs :: BuildOptions Aff -> List (Module Ann) -> Aff Unit
buildModulesWithJobs options modules = do
  jobs <- liftEffect optimizerConcurrency
  if jobs == 1 then buildModules options modules
  else supervise do
    results <- AVar.empty
    let scheduler =
          { fork: \job -> void $ forkAff do
              result <- attempt (job unit)
              AVar.put result results
          , await: do
              result <- AVar.take results
              either throwError pure result
          }
    buildModulesParallel
      { jobs
      , scheduler
      , onStats: Just \stats -> liftEffect $ Console.error $
          "[purust] PBO jobs=" <> show jobs
            <> " dispatched=" <> show stats.dispatched
            <> " fallback=" <> show stats.fallbackDispatched
            <> " deferred=" <> show stats.deferredAttempts
            <> " attempts-ms=" <> show stats.attemptMillis
            <> " codegen-ms=" <> show stats.emitMillis
      }
      options
      modules
