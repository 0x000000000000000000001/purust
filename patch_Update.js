import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /in "_mut." <> sanitizeIdent k <> " = Some\(" <> codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForProp false v <> "\);"/,
    `let valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForProp false v
            let valTy = inferTypeExpr currentMod aritiesMap bound v
        in "_mut." <> sanitizeIdent k <> " = Some(" <> boxUnbox Any valTy valCode <> ");"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
