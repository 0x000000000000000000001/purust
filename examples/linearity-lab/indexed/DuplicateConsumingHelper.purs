module LinearLab.Indexed.DuplicateConsumingHelper where

import Prelude (Unit)
import LinearLab.Indexed.Api as R
import Prim.Row as Row

-- A faulty generic helper cannot honestly claim one consumption while invoking
-- its consuming callback twice. The intermediate indices do not match.
bad :: forall scope key used live rest a.
  Row.Cons key Unit rest live =>
  R.Handle scope key ->
  (R.Handle scope key -> R.Ix scope (R.State used live) (R.State used rest) a) ->
  R.Ix scope (R.State used live) (R.State used rest) a
bad resource callback = R.do
  _ <- callback resource
  callback resource
