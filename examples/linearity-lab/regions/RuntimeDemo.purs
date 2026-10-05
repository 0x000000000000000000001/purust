module LinearLab.Regions.RuntimeDemo where

import Prelude
import Effect (Effect)
import LinearLab.Regions.Guarded as G
import LinearLab.Regions.STActual (aliasedWrites)

main :: Effect Unit
main = do
  G.assertEqual 30 aliasedWrites
  handle <- G.open 10
  let alias = handle
  let action = G.finish handle
  initial <- G.inspect handle
  G.assertEqual 10 initial
  first <- action
  G.assertEqual 10 first
  replay <- action
  G.assertEqual (-1) replay
  repeatedAlias <- G.finish alias
  G.assertEqual (-1) repeatedAlias
  readConsumed <- G.inspect alias
  G.assertEqual (-1) readConsumed

  reentrant <- G.open 20
  -- Native code holds a borrow lock while it calls this PureScript Effect.
  busy <- G.withBorrow reentrant (G.finish reentrant)
  G.assertEqual (-2) busy
  retained <- G.inspect reentrant
  G.assertEqual 20 retained
  closed <- G.finish reentrant
  G.assertEqual 20 closed

  concurrent <- G.open 30
  -- The wrapper launches two real Rust threads against one native owner.
  raceResult <- G.race concurrent
  G.assertEqual 30 raceResult
  afterRace <- G.finish concurrent
  G.assertEqual (-1) afterRace
  G.verify
