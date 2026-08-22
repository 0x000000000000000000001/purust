module Test where
import Prelude
updateRecord :: { a :: Int, b :: Int } -> { a :: Int, b :: Int }
updateRecord r = r { a = 1 }
