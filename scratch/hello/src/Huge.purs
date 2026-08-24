module Huge where
type HugeRecord = { a :: Int, b :: String, c :: Boolean, d :: Int, e :: Int, f :: Int, g :: Int, h :: Int, i :: Int, j :: Int }
foo :: HugeRecord -> HugeRecord -> HugeRecord
foo x y = x
bar = foo
baz = bar
qux = baz
