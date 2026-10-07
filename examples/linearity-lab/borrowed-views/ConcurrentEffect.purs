module LinearLab.BorrowedViews.ConcurrentEffect where

import Prelude
import Effect (Effect)
import LinearLab.BorrowedViews.Api as B

-- A scheduling primitive accepting ordinary Effect cannot launch an indexed
-- borrow action. No public lift/unlift bypasses the scope/state requirement.
foreign import fork :: Effect Unit -> Effect Unit

bad :: forall scope. B.Buffer scope -> Effect Unit
bad buffer = fork (B.append buffer "concurrent")
