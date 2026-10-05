module AliasedFinish where

import Session (finish, then_)

invalid = let again = finish in then_ finish again
