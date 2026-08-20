module DumpAST where
import Prelude
import Effect (Effect)
import Effect.Console as Console
import PureScript.Backend.Optimizer.CoreFn (Expr(..), ExprType(..), Ident(..))
import Purust.CodeGen (inferTypeExpr)
import Data.Map as Map

main :: Effect Unit
main = Console.log "Test"
