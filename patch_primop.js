import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const op1_replacement = `  PrimOp (Op1 op a) ->
    let aTy = inferTypeExpr currentMod aritiesMap bound a
        aStrRaw = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound alive false a
    in case op of
      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> ")"
      OpIntBitNot -> "!(" <> boxUnbox Int aTy aStrRaw <> ")"
      OpIntNegate -> "-(" <> boxUnbox Int aTy aStrRaw <> ")"
      OpNumberNegate -> "-(" <> boxUnbox Number aTy aStrRaw <> ")"
      OpArrayLength -> "((" <> boxUnbox Any aTy aStrRaw <> ").init_array.as_ref().unwrap().len() as i64)"
      OpIsTag (Qualified _ (Ident ctorName)) -> "(" <> boxUnbox Any aTy aStrRaw <> ".tag == \\"" <> ctorName <> "\\")"
      _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op1 */"
`;

const op2_replacement = `  PrimOp (Op2 op a b) ->
    let aliveForA = Set.union alive (freeVariables b)
        aTy = inferTypeExpr currentMod aritiesMap bound a
        bTy = inferTypeExpr currentMod aritiesMap bound b
        aStrRaw = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForA false a
        bStrRaw = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound alive false b
        aStrInt = boxUnbox Int aTy aStrRaw
        bStrInt = boxUnbox Int bTy bStrRaw
        aStrBool = boxUnbox Boolean aTy aStrRaw
        bStrBool = boxUnbox Boolean bTy bStrRaw
        aStrNum = boxUnbox Number aTy aStrRaw
        bStrNum = boxUnbox Number bTy bStrRaw
        aStrStr = boxUnbox String aTy aStrRaw
        bStrStr = boxUnbox String bTy bStrRaw
    in case op of
      OpIntNum OpAdd -> "(" <> aStrInt <> " + " <> bStrInt <> ")"
      OpIntNum OpSubtract -> "(" <> aStrInt <> " - " <> bStrInt <> ")"
      OpIntNum OpMultiply -> "(" <> aStrInt <> " * " <> bStrInt <> ")"
      OpIntNum OpDivide -> "(" <> aStrInt <> " / " <> bStrInt <> ")"
      OpIntBitAnd -> "(" <> aStrInt <> " & " <> bStrInt <> ")"
      OpIntBitOr -> "(" <> aStrInt <> " | " <> bStrInt <> ")"
      OpIntBitXor -> "(" <> aStrInt <> " ^ " <> bStrInt <> ")"
      OpIntBitShiftLeft -> "(" <> aStrInt <> " << " <> bStrInt <> ")"
      OpIntBitShiftRight -> "(" <> aStrInt <> " >> " <> bStrInt <> ")"
      OpIntBitZeroFillShiftRight -> "((" <> aStrInt <> " as u64 >> " <> bStrInt <> " as u64) as i64)"
      OpIntOrd OpEq -> "(" <> aStrInt <> " == " <> bStrInt <> ")"
      OpIntOrd OpNotEq -> "(" <> aStrInt <> " != " <> bStrInt <> ")"
      OpIntOrd OpGt -> "(" <> aStrInt <> " > " <> bStrInt <> ")"
      OpIntOrd OpGte -> "(" <> aStrInt <> " >= " <> bStrInt <> ")"
      OpIntOrd OpLt -> "(" <> aStrInt <> " < " <> bStrInt <> ")"
      OpIntOrd OpLte -> "(" <> aStrInt <> " <= " <> bStrInt <> ")"
      OpNumberOrd OpEq -> "(" <> aStrNum <> " == " <> bStrNum <> ")"
      OpNumberOrd OpNotEq -> "(" <> aStrNum <> " != " <> bStrNum <> ")"
      OpNumberOrd OpGt -> "(" <> aStrNum <> " > " <> bStrNum <> ")"
      OpNumberOrd OpGte -> "(" <> aStrNum <> " >= " <> bStrNum <> ")"
      OpNumberOrd OpLt -> "(" <> aStrNum <> " < " <> bStrNum <> ")"
      OpNumberOrd OpLte -> "(" <> aStrNum <> " <= " <> bStrNum <> ")"
      OpStringOrd OpEq -> "(" <> aStrStr <> " == " <> bStrStr <> ")"
      OpStringOrd OpNotEq -> "(" <> aStrStr <> " != " <> bStrStr <> ")"
      OpStringOrd OpGt -> "(" <> aStrStr <> " > " <> bStrStr <> ")"
      OpStringOrd OpGte -> "(" <> aStrStr <> " >= " <> bStrStr <> ")"
      OpStringOrd OpLt -> "(" <> aStrStr <> " < " <> bStrStr <> ")"
      OpStringOrd OpLte -> "(" <> aStrStr <> " <= " <> bStrStr <> ")"
      OpCharOrd OpEq -> "(" <> boxUnbox Char aTy aStrRaw <> " == " <> boxUnbox Char bTy bStrRaw <> ")"
      OpCharOrd OpNotEq -> "(" <> boxUnbox Char aTy aStrRaw <> " != " <> boxUnbox Char bTy bStrRaw <> ")"
      OpCharOrd OpGt -> "(" <> boxUnbox Char aTy aStrRaw <> " > " <> boxUnbox Char bTy bStrRaw <> ")"
      OpCharOrd OpGte -> "(" <> boxUnbox Char aTy aStrRaw <> " >= " <> boxUnbox Char bTy bStrRaw <> ")"
      OpCharOrd OpLt -> "(" <> boxUnbox Char aTy aStrRaw <> " < " <> boxUnbox Char bTy bStrRaw <> ")"
      OpCharOrd OpLte -> "(" <> boxUnbox Char aTy aStrRaw <> " <= " <> boxUnbox Char bTy bStrRaw <> ")"
      OpBooleanOrd OpEq -> "(" <> aStrBool <> " == " <> bStrBool <> ")"
      OpBooleanOrd OpNotEq -> "(" <> aStrBool <> " != " <> bStrBool <> ")"
      OpBooleanOrd OpGt -> "(" <> aStrBool <> " > " <> bStrBool <> ")"
      OpBooleanOrd OpGte -> "(" <> aStrBool <> " >= " <> bStrBool <> ")"
      OpBooleanOrd OpLt -> "(" <> aStrBool <> " < " <> bStrBool <> ")"
      OpBooleanOrd OpLte -> "(" <> aStrBool <> " <= " <> bStrBool <> ")"
      OpBooleanAnd -> "(" <> aStrBool <> " && " <> bStrBool <> ")"
      OpBooleanOr -> "(" <> aStrBool <> " || " <> bStrBool <> ")"
      OpArrayIndex -> 
        let aStr = boxUnbox Any aTy aStrRaw
        in "(" <> aStr <> ").init_array.as_ref().unwrap()[(" <> bStrInt <> ") as usize].clone()"
      OpNumberNum OpAdd -> "(" <> aStrNum <> " + " <> bStrNum <> ")"
      OpNumberNum OpSubtract -> "(" <> aStrNum <> " - " <> bStrNum <> ")"
      OpNumberNum OpMultiply -> "(" <> aStrNum <> " * " <> bStrNum <> ")"
      OpNumberNum OpDivide -> "(" <> aStrNum <> " / " <> bStrNum <> ")"
      OpStringAppend -> "format!(\\"{}{}\\", " <> aStrStr <> ", " <> bStrStr <> ")"
      _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Op2 */"
`;

// Replace Op1 block
code = code.replace(/  PrimOp \(Op1 op a\) ->\n(?:.*?\n)+?      _ -> "{ let _t: crate::UnknownType = unimplemented!\(\); _t } \/\* Unsupported Op1 \*\/"\n/, op1_replacement);
// Replace Op2 block
code = code.replace(/  PrimOp \(Op2 op a b\) ->\n(?:.*?\n)+?      OpBooleanOr -> "mk_bool\(\(" <> aStr <> "\).init_bool.unwrap\(\) \|\| \(" <> bStr <> "\).init_bool.unwrap\(\)\)"\n/, op2_replacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
