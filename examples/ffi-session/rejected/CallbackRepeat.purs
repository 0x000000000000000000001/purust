module CallbackRepeat where

import Data.Unit (unit)
import Session (finish, then_)

invalid = let next _ = finish in then_ (next unit) (next unit)
