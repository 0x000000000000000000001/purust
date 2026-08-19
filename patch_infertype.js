import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// We need to add `PrimOp` to `inferTypeExpr`
// Wait, `PrimOp` returns:
// OpBooleanAnd, OpBooleanOr, OpBooleanNot -> Boolean
// OpIntBitNot, OpIntNegate, OpNumberNum, OpIntNum, OpArrayLength -> Int / Number depending on Op
// Let's just add `PrimOp` to return `Boolean` for OpBoolean*, `Int` for OpInt*, `Number` for OpNumber*, `String` for OpStringAppend
// Actually, an easier fix is: if `boxUnbox` is asked to box `Boolean` from `Any`, and the code already looks like `!(...)` or `(...) == (...)` or `(...) && (...)`, we can just NOT unbox it again!
// But wait, the code is NOT a string literal we can inspect easily in PureScript, it's just a string!
// It's better to fix `inferTypeExpr` to handle `PrimOp`.

// And also `Accessor`!
// What is the type of `Accessor`? We don't know without looking up the record type. So `Accessor` is `Any`.
// What is the type of `OpStringAppend`? `String`.
// What is the type of `OpBooleanNot`? `Boolean`.

const primOpInfer = `
  PrimOp (Op1 op _) -> case op of
    OpBooleanNot -> Boolean
    OpIntBitNot -> Int
    OpIntNegate -> Int
    OpNumberNegate -> Number
    OpArrayLength -> Int
    OpIsTag _ -> Boolean
    _ -> Any
  PrimOp (Op2 op _ _) -> case op of
    OpIntNum _ -> Int
    OpNumberNum _ -> Number
    OpBooleanAnd -> Boolean
    OpBooleanOr -> Boolean
    OpBooleanOrd _ -> Boolean
    OpStringAppend -> String
    _ -> Any
`;

code = code.replace(/  Lit lit -> case lit of\n    LitInt _ -> Int/,
primOpInfer + `  Lit lit -> case lit of
    LitInt _ -> Int`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
