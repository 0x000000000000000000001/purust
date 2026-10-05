module DoubleFinish where

import Session (finish, then_)

invalid = then_ finish finish
