import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '  Typed ty inner -> \n    let innerCode = codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive inEffectBlock inner\n        innerTy = inferTypeExpr currentMod aritiesMap bound inner\n    in boxUnbox ty innerTy innerCode',
    '  Typed ty inner -> \n    let innerCode = codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive inEffectBlock inner\n        innerTy = inferTypeExpr currentMod aritiesMap bound inner\n    in "/* Typed " <> codegenExprType true ty <> " <- " <> codegenExprType true innerTy <> " : " <> printAST inner <> " */" <> boxUnbox ty innerTy innerCode'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
