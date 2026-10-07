module LinearLab.BorrowedViews.DeferredClosure where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

bad :: forall scope view.
  Effect (Unit -> B.Ix scope (B.Borrowed view) (B.Borrowed view) Int)
bad = B.withBuffer "ab" \buffer -> B.withView buffer \view ->
  B.pure (\_ -> B.checksum view)
