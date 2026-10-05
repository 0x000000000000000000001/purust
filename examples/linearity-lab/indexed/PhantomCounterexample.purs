module LinearLab.Indexed.PhantomCounterexample where

-- STATIC COUNTEREXAMPLE ONLY: no foreign resource and no execution.
-- Even nominal state roles do not invalidate aliases after a function call.
data Open
data Closed
newtype Handle state = Handle Int
type role Handle nominal

finish :: Handle Open -> Handle Closed
finish (Handle value) = Handle value

acceptedDuplicate :: Handle Open -> { first :: Handle Closed, second :: Handle Closed }
acceptedDuplicate original =
  let alias = original
  in { first: finish original, second: finish alias }
