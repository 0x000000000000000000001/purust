module RecordKeywordProbe where

import Record.Unsafe (unsafeGet, unsafeSet)

type Fields = { final :: Int, final_kw :: Int }

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
