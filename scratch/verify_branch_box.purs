module VerifyBranchBox where
import Prelude
import Effect (Effect)
import Effect.Console (log)
import Purust.CodeGen (boxUnbox, ExprType(..), codegenExprType)

main :: Effect Unit
main = do
  let branchTy = Func [Any] Any
  let bodyTy = Any
  let bodyCodeRaw = "/* Typed crate::UnknownType <- crate::UnknownType : App(Local(...)) */(f.clone())(...)"
  let res = boxUnbox branchTy bodyTy bodyCodeRaw
  log ("res: " <> res)
