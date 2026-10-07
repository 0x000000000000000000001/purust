module LinearLab.Capabilities.OrdinaryDrop where

import Prelude (Unit, unit)
import LinearLab.Capabilities.Sub as S
bad :: S.Sub S.Owned Unit
bad = \_ -> unit
