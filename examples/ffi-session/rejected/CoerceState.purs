module CoerceState where

import Safe.Coerce (coerce)
import Session (Program, Open, finish)

invalid :: Program Open Open
invalid = coerce finish
