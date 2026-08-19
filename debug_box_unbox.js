import { execSync } from 'child_process';
const pursCode = `
module Test.Main where
import Prelude
import Effect.Console (log)
import Purust.CodeGen (boxUnbox, ExprType(..))
main = log (boxUnbox Boolean Any "my_code")
`;
// We can't easily compile this... wait, yes we can use spago script or just node.
