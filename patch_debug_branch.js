import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/  Branch _ def -> inferTypeExpr currentMod aritiesMap bound def/,
`  Branch _ def -> 
    let t = inferTypeExpr currentMod aritiesMap bound def
        _ = Debug.trace ("Branch def type: " <> codegenExprType true t <> " for def: " <> printAST def) \\_ -> unit
    in t`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
