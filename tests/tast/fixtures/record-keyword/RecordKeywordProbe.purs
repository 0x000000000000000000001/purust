module RecordKeywordProbe where

import Record.Unsafe (unsafeGet, unsafeSet)

type Fields = { final :: Int, final_kw :: Int }

type SelfFields = { self :: Int, other :: Int }

make :: Int -> Int -> Fields
make finalValue otherValue = { final: finalValue, final_kw: otherValue }

readFinal :: Fields -> Int
readFinal value = value.final

readOther :: Fields -> Int
readOther value = value.final_kw

replaceFinal :: Int -> Fields -> Fields
replaceFinal finalValue value = value { final = finalValue }

readDynamic :: String -> Fields -> Int
readDynamic = unsafeGet

replaceDynamic :: String -> Int -> Fields -> Fields
replaceDynamic = unsafeSet

makeSelf :: Int -> Int -> SelfFields
makeSelf selfValue otherValue = { self: selfValue, other: otherValue }

readSelf :: SelfFields -> Int
readSelf value = value.self

readSelfOther :: SelfFields -> Int
readSelfOther value = value.other

replaceSelf :: Int -> SelfFields -> SelfFields
replaceSelf selfValue value = value { self = selfValue }

readSelfDynamic :: String -> SelfFields -> Int
readSelfDynamic = unsafeGet

replaceSelfDynamic :: String -> Int -> SelfFields -> SelfFields
replaceSelfDynamic = unsafeSet

type CollisionFields = { gen :: Int, gen_kw :: Int }

makeCollision :: Int -> Int -> CollisionFields
makeCollision genValue otherValue = { gen: genValue, gen_kw: otherValue }

readGen :: CollisionFields -> Int
readGen value = value.gen

readGenKw :: CollisionFields -> Int
readGenKw value = value.gen_kw

replaceGen :: Int -> CollisionFields -> CollisionFields
replaceGen genValue value = value { gen = genValue }
