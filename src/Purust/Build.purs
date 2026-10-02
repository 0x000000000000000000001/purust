module Purust.Build (buildModulesWithJobs, buildModulesInScope, buildConcurrency) where

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
foreign import codegenConcurrency :: Effect Int

-- Concurrent generation reserves slots from the optimizer's worker budget.
-- A one-slot codegen stays on the coordinator, preserving the reference path.
buildConcurrency :: Effect { optimize :: Int, codegen :: Int, budget :: Int }
buildConcurrency = do
  budget <- optimizerConcurrency
  requested <- codegenConcurrency
  let codegen = min requested (max 1 (budget - 1))
  pure { budget, codegen, optimize: if codegen == 1 then budget else budget - codegen }

-- Standalone entry point owns worker lifetime, including publication failures.
buildModulesWithJobs :: BuildOptions Aff -> List (Module Ann) -> Aff Unit
buildModulesWithJobs options modules = supervise (buildModulesInScope options modules)

-- The CLI's withEmitter supervises optimization AND generation through the
-- final ordered drain. An inner supervisor here would cancel queued generation
-- workers as soon as PBO finishes, before their results could be published.
buildModulesInScope :: BuildOptions Aff -> List (Module Ann) -> Aff Unit
buildModulesInScope options modules = do
  concurrency <- liftEffect buildConcurrency
  let jobs = concurrency.optimize
  if jobs == 1 then buildModules options modules
  else do
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
            <> " codegen-jobs=" <> show concurrency.codegen
            <> " budget=" <> show concurrency.budget
      }
      options
      modules
