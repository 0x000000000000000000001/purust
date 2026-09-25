-- A derived Eq instance for a recursive syntax tree must stay compact.
-- The tree mirrors the shape reported in the purust issue: a 16-constructor
-- `Term` with one- and two-field recursive constructors plus an Array field,
-- a `QueryTerm` and a `RepeatSpec` that embed `Term`, and a `BehaviourF r`
-- whose Eq dictionary depends on `Eq r`.
module DerivedEqProbe where

import Prelude

type Arg = { label :: String, term :: Term }

data Term
  = ELit Int
  | EVar String
  | ENot Term
  | EAnd Term Term
  | EOr Term Term
  | EEq Term Term
  | ELt Term Term
  | EAdd Term Term
  | ESub Term Term
  | EField String Term
  | EIndex Int Term
  | ECount Term
  | EEmpty Term
  | EDist Term Term
  | EList (Array Term)
  | ESumWhere String Term Term Term

derive instance eqTerm :: Eq Term

data QueryTerm
  = QCall String (Array Arg)
  | QFirstOf (Array QueryTerm)
  | QGiven Term

derive instance eqQueryTerm :: Eq QueryTerm

data RepeatSpec = Forever | Times Int | Until Term

derive instance eqRepeatSpec :: Eq RepeatSpec

data BehaviourF r
  = Do String (Array Arg)
  | Seq (Array r)
  | Select (Array r)
  | Race (Array r)
  | Guard Term
  | Bind String QueryTerm r
  | ForEach String QueryTerm r
  | WithState QueryTerm r
  | SetState String Term
  | Repeat RepeatSpec r
  | While Term r
  | Timeout Int r
  | Commit Int r
  | Invert r
  | Succeed
  | Fail String

derive instance eqBehaviourF :: Eq r => Eq (BehaviourF r)

-- Nested patterns put the constructor path of `t` in front of every inner
-- test. The path to the inner `Term` must be bound once per outer arm instead
-- of being re-matched from `t` for each alternative.
nested :: Term -> Int
nested t = case t of
  ENot (ELit value) -> value
  ENot (EVar _) -> 1
  ENot (EAnd _ _) -> 2
  ENot (EList _) -> 3
  ENot (ESumWhere _ _ _ _) -> 4
  ENot _ -> 5
  _ -> 0

nestedLit :: Int
nestedLit = nested (ENot (ELit 42))

nestedVar :: Int
nestedVar = nested (ENot (EVar "x"))

nestedAnd :: Int
nestedAnd = nested (ENot (EAnd (ELit 1) (ELit 2)))

nestedList :: Int
nestedList = nested (ENot (EList [ ELit 1 ]))

nestedSum :: Int
nestedSum = nested (ENot (ESumWhere "s" (ELit 1) (ELit 2) (ELit 3)))

nestedFallback :: Int
nestedFallback = nested (ENot (EAdd (ELit 1) (ELit 2)))

nestedOther :: Int
nestedOther = nested (ELit 42)

-- A user instance must keep its own method: `Key` values that differ
-- structurally are equal when they are congruent modulo ten.
data Key = Key Int

instance eqKey :: Eq Key where
  eq (Key left) (Key right) = left `mod` 10 == right `mod` 10

keyBox :: BehaviourF Key
keyBox = Seq [ Key 1, Key 2 ]

keyCongruent :: BehaviourF Key
keyCongruent = Seq [ Key 11, Key 12 ]

keyDifferent :: BehaviourF Key
keyDifferent = Seq [ Key 1, Key 3 ]

keyCustomEqual :: Boolean
keyCustomEqual = keyBox == keyCongruent

keyCustomDifferent :: Boolean
keyCustomDifferent = keyBox == keyDifferent

sample :: BehaviourF Term
sample =
  Bind "x"
    (QCall "f" [ { label: "a", term: EAdd (ELit 1) (EVar "y") } ])
    (ENot (EField "k" (EList [ ECount (ELit 2), EDist (ELit 3) (EVar "z") ])))

other :: BehaviourF Term
other =
  Bind "x"
    (QCall "f" [ { label: "a", term: EAdd (ELit 1) (EVar "y") } ])
    (ENot (EField "k" (EList [ ECount (ELit 2), EDist (ELit 4) (EVar "z") ])))

same :: Boolean
same = sample == sample

different :: Boolean
different = sample == other

differentTypes :: Boolean
differentTypes = sample /= Bind "z" (QGiven (ELit 7)) (ENot (EVar "q"))

equalQuery :: Boolean
equalQuery = QGiven (EAdd (ELit 1) (ELit 2)) == QGiven (EAdd (ELit 1) (ELit 2))

differentQuery :: Boolean
differentQuery = QGiven (EAdd (ELit 1) (ELit 2)) == QGiven (EAdd (ELit 1) (ELit 3))

equalRepeat :: Boolean
equalRepeat = Times 4 == Times 4

differentRepeat :: Boolean
differentRepeat = Until (EVar "x") == Until (EVar "y")

equalCall :: Boolean
equalCall = QCall "f" [ { label: "a", term: ELit 1 } ] == QCall "f" [ { label: "a", term: ELit 1 } ]

differentLabel :: Boolean
differentLabel = QCall "f" [ { label: "a", term: ELit 1 } ] == QCall "f" [ { label: "b", term: ELit 1 } ]

differentTerm :: Boolean
differentTerm = QCall "f" [ { label: "a", term: ELit 1 } ] == QCall "f" [ { label: "a", term: ELit 2 } ]

differentLength :: Boolean
differentLength = QCall "f" [ { label: "a", term: ELit 1 } ] == QCall "f" []
