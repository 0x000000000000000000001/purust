module CoerceInput where

import Safe.Coerce (coerce)
import Session (Program, Closed, finish)

invalid :: Program Closed Closed
invalid = coerce finish
