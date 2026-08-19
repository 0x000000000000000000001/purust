import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /valTyStr = extractFinalRetType \(codegenExprType false aritiesMap bound val\)\s+in boxUnbox Any valTyStr valCode/,
    `valTy = inferTypeExpr currentMod aritiesMap bound val
            in boxUnbox Any valTy valCode`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
