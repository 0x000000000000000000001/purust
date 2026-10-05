module ReadAfterFinish where

import Session (finish, inspect, then_)

invalid = then_ finish inspect
