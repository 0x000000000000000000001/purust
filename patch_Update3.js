import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /let valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForProp false v\s+let valTy = inferTypeExpr currentMod aritiesMap bound v\s+in "_mut." <> sanitizeIdent k <> " = Some\(" <> boxUnbox Any valTy valCode <> "\);"/,
    `valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForProp false v
            valTy = inferTypeExpr currentMod aritiesMap bound v
        in "_mut." <> sanitizeIdent k <> " = Some(" <> boxUnbox Any valTy valCode <> ");"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
