module AnnotationScope where

import Prelude

data Wrapped a = Wrapped a

adapt :: forall a b. (a -> b) -> a -> b
adapt f = f <<< identity

foreign import call :: forall a b. (a -> Wrapped b) -> a -> Wrapped b

-- The TAST call to adapt has a specialised annotation but no explicit TypeApp.
-- Its generic b denotes Wrapped b from this scope, not this scope's payload b.
wrap :: forall a b. (a -> Wrapped b) -> a -> Wrapped b
wrap f = adapt $ call f
