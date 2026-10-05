module LinearLab.Indexed.Helpers
  ( withSession, borrowLoop, repeatBorrow, consumeWith
  ) where

import Prelude
import Effect (Effect)
import LinearLab.Indexed.Api as R
import Prim.Row as Row
import Type.Proxy (Proxy(..))

-- A library can hide the symbolic name for a single-resource scope. The caller
-- supplies neither Proxy nor state types; the callback must consume the handle.
withSession :: forall a. Int ->
  (forall scope.
    R.Handle scope "session" ->
    R.Ix scope
      (R.State (session :: Unit) (session :: Unit))
      (R.State (session :: Unit) ()) a) ->
  Effect a
withSession value callback = R.run R.do
  resource <- R.open (Proxy :: Proxy "session") value
  callback resource

-- This reusable helper does not name a concrete resource or concrete row.
-- Recursion can borrow/mutate any number of times because it preserves state.
borrowLoop :: forall scope key used live rest.
  Row.Cons key Unit rest live =>
  R.Handle scope key -> Int ->
  R.Ix scope (R.State used live) (R.State used live) Int
borrowLoop resource remaining =
  if remaining <= 0 then R.pure 0
  else R.do
    value <- R.inspect resource
    R.add resource 1
    accumulated <- borrowLoop resource (remaining - 1)
    R.pure (value + accumulated)

-- The index-preserving callback may be called repeatedly. A consuming callback
-- cannot be substituted because its input and output capabilities differ.
repeatBorrow :: forall scope state.
  Int -> (Int -> R.Ix scope state state Unit) -> R.Ix scope state state Unit
repeatBorrow remaining callback =
  if remaining <= 0 then R.pure unit
  else R.do
    callback remaining
    repeatBorrow (remaining - 1) callback

-- Unlike repeatBorrow, the callback carries a transition removing one live
-- capability. It may transform the result after consumption, but the helper
-- cannot call it twice and still satisfy its signature.
consumeWith :: forall scope key used live rest a.
  Row.Cons key Unit rest live =>
  R.Handle scope key ->
  (R.Handle scope key -> R.Ix scope (R.State used live) (R.State used rest) a) ->
  R.Ix scope (R.State used live) (R.State used rest) a
consumeWith resource callback = callback resource
