module ModuleInitProbe.Counter where

import Data.Unit (Unit)
import Effect (Effect)

foreign import tick :: Effect Unit
foreign import readCount :: Effect Int
