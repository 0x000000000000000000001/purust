import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> " /* aTy: " <> codegenExprType true aTy <> ", a is " <> printAST a <> ", fn ty is " <> (case a of\n        NeutralExpr (App fn _) -> printType (inferTypeExpr currentMod aritiesMap bound fn)\n        _ -> "not app") <> " */)"',
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> " /* aTy: " <> codegenExprType true aTy <> ", a is " <> printAST a <> ", fn ty is " <> (case a of\n        NeutralExpr (App fn _) -> printType (inferTypeExpr currentMod aritiesMap bound fn) <> ", lvl_3 in bound: " <> (case Map.lookup "lvl_3" bound of Just t -> printType t; Nothing -> "none") <> ", lvl_3 in arities: " <> (case Map.lookup "lvl_3" aritiesMap of Just t -> printType t; Nothing -> "none")\n        _ -> "not app") <> " */)"'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
