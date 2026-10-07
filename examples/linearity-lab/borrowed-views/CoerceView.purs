module LinearLab.BorrowedViews.CoerceView where

import LinearLab.BorrowedViews.Api as B
import Safe.Coerce (coerce)

bad :: forall scope old current. B.View scope old -> B.View scope current
bad = coerce
