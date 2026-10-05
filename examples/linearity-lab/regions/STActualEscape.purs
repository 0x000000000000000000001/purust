module LinearLab.Regions.STActualEscape where

import Control.Monad.ST as ST
import Control.Monad.ST.Ref as Ref

escapedRef :: forall scope. Ref.STRef scope Int
escapedRef = ST.run (Ref.new 10)
