-- The recursive instances must keep working across modules: their methods are
-- no longer unrolled, so the consumer uses the runtime dictionaries.
module DerivedEqConsumer where

import Prelude
import DerivedEqProbe (BehaviourF, QueryTerm(..), Term(..), other, sample)

crossModuleSame :: Boolean
crossModuleSame = sample == sample

crossModuleDifferent :: Boolean
crossModuleDifferent = sample == other

crossModuleGiven :: Boolean
crossModuleGiven = QGiven (ELit 1) == QGiven (ELit 1)

crossModuleGivenDifferent :: Boolean
crossModuleGivenDifferent = QGiven (ELit 1) == QGiven (ELit 2)

genericSame :: forall a. Eq a => BehaviourF a -> Boolean
genericSame value = value == value
