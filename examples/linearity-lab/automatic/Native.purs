module LinearLab.Automatic.Native where

import Effect (Effect)
import Data.Unit (Unit)

foreign import data Session :: Type
foreign import open :: Int -> Effect Session
foreign import inspect :: Session -> Effect Int
foreign import add :: Session -> Int -> Effect Unit
foreign import finish :: Session -> Effect Int
foreign import combine :: Session -> Session -> Effect Int
