module LinearLab.BorrowedViews.CoerceState where

import LinearLab.BorrowedViews.Api as B
import Safe.Coerce (coerce)

bad :: forall scope view a.
  B.Ix scope (B.Borrowed view) (B.Borrowed view) a ->
  B.Ix scope B.Ready B.Ready a
bad = coerce
