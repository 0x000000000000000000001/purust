module Session
  ( Program
  , Open
  , Closed
  , idle
  , add
  , inspect
  , finish
  , then_
  , run
  ) where

import Data.Unit (Unit, unit)
import Effect (Effect)

data Open
data Closed

-- Only an immutable description crosses the FFI. The native session never does.
foreign import data Plan :: Type

newtype Program :: Type -> Type -> Type
newtype Program before after = Program Plan

-- Without nominal roles, Safe.Coerce could turn Closed back into Open.
type role Program nominal nominal

foreign import emptyPlan :: Unit -> Plan
foreign import addPlan :: Int -> Plan
foreign import inspectPlan :: Unit -> Plan
foreign import appendPlan :: Plan -> Plan -> Plan
foreign import runPlan :: Int -> Plan -> Effect Int

idle :: forall state. Program state state
idle = Program (emptyPlan unit)

add :: Int -> Program Open Open
add amount = Program (addPlan amount)

inspect :: Program Open Open
inspect = Program (inspectPlan unit)

-- This seals the description. The Rust runner performs finish(self) once,
-- after its open-state operations, rather than interpreting a Close opcode.
finish :: Program Open Closed
finish = Program (emptyPlan unit)

then_ :: forall before middle after.
  Program before middle -> Program middle after -> Program before after
then_ (Program left) (Program right) = Program (appendPlan left right)

-- Every execution of this Effect opens a fresh native session, including
-- repeated executions of the exact same action or the same description.
run :: Int -> Program Open Closed -> Effect Int
run initial (Program plan) = runPlan initial plan
