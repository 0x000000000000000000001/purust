module LinearLab.Regions.STActual where

import Prelude
import Control.Monad.ST as ST
import Control.Monad.ST.Ref as Ref

-- The installed ST implementation intentionally permits local aliasing.
aliasedWrites :: Int
aliasedWrites = ST.run do
  reference <- Ref.new 10
  let alias = reference
  _ <- Ref.write 20 reference
  _ <- Ref.write 30 alias
  Ref.read reference
