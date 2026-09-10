-- @inline RecordBorrows.writeAfterRead never
module RecordBorrows where

import Prelude

type Leaf =
  { tally :: Int
  , ratio :: Number
  , flag :: Boolean
  , glyph :: Char
  , note :: String
  , action :: Unit -> Int
  , tally_ref :: Int
  , ref_tally :: Int
  }
type Middle = { offset :: Int, leaf :: Leaf }
type Root = { seed :: Int, middle :: Middle, title :: String }
data Versions = Versions Root Root
data Saved = Saved (Unit -> Int)

sample :: Int -> Root
sample seed =
  { seed
  , title: "root"
  , middle:
      { offset: seed + 2
      , leaf:
          { tally: seed + 5
          , ratio: 3.5
          , flag: true
          , glyph: 'λ'
          , note: "leaf"
          , action: \_ -> seed + 9
          , tally_ref: seed + 11
          , ref_tally: seed + 13
          }
      }
  }

readRoot :: Root -> Int
readRoot root = root.seed

readMiddle :: Root -> Int
readMiddle root = root.middle.offset

readDeep :: Root -> Int
readDeep root = root.middle.leaf.tally

readNumber :: Root -> Number
readNumber root = root.middle.leaf.ratio

readBoolean :: Root -> Boolean
readBoolean root = root.middle.leaf.flag

readChar :: Root -> Char
readChar root = root.middle.leaf.glyph

readCollision :: Root -> Int
readCollision root = root.middle.leaf.tally + root.middle.leaf.tally_ref + root.middle.leaf.ref_tally

notFlag :: Root -> Boolean
notFlag root = not root.middle.leaf.flag

negateTally :: Root -> Int
negateTally root = negate root.middle.leaf.tally

negateRatio :: Root -> Number
negateRatio root = negate root.middle.leaf.ratio

numberPlus :: Number -> Root -> Number
numberPlus delta root = root.middle.leaf.ratio + delta

numberBefore :: Number -> Root -> Boolean
numberBefore bound root = root.middle.leaf.ratio < bound

charBefore :: Char -> Root -> Boolean
charBefore bound root = root.middle.leaf.glyph < bound

andThen :: (Unit -> Boolean) -> Root -> Boolean
andThen next root = root.middle.leaf.flag && next unit

orElse :: (Unit -> Boolean) -> Root -> Boolean
orElse next root = root.middle.leaf.flag || next unit

branchRead :: Root -> Int
branchRead root = if root.middle.leaf.flag then root.middle.leaf.tally else root.middle.offset

-- These returned values must keep their owned getters and outlive the root.
ownedMiddle :: Root -> Middle
ownedMiddle root = root.middle

ownedLeaf :: Root -> Leaf
ownedLeaf root = root.middle.leaf

ownedString :: Root -> String
ownedString root = root.middle.leaf.note

ownedFunction :: Root -> Saved
ownedFunction root = Saved root.middle.leaf.action

-- The chain has an opaque receiver, evaluated once before the scalar read.
callerOpaque :: (Root -> Root) -> Root -> Int
callerOpaque make root = (make root).middle.leaf.tally

orderedOpaque :: (Int -> Int) -> (Root -> Root) -> Root -> Int
orderedOpaque observe make root = observe ((make root).middle.leaf.tally)

writeAfterRead :: Root -> Root
writeAfterRead root =
  let before = root.middle.leaf.tally
  in root
    { seed = before
    , middle = root.middle
        { offset = root.middle.offset + 1
        , leaf = root.middle.leaf { tally = before + 1 }
        }
    }

retain :: Root -> Versions
retain root = Versions (writeAfterRead root) root

save :: Root -> Saved
save root = Saved (\_ -> root.middle.leaf.tally)

withAction :: (Unit -> Int) -> Root -> Root
withAction action root = root { middle = root.middle { leaf = root.middle.leaf { action = action } } }
