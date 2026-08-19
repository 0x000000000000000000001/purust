import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Patch Let in codegenExpr_
code = code.replace(/        bodyVars = freeVariables body\n        deadCode = if Set\.member name bodyVars then "" else "    " <> name <> "\.drop_explicit\(\);\\n"\n    in\n    "{\\n" <>\n    "    let mut " <> name <> " = " <> valCode <> ";\\n" <>\n    deadCode <>\n    "    " <> codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive inEffectBlock body <> "\\n" <>\n    "}"/,
`        bodyVars = freeVariables body
        deadCode = if Set.member name bodyVars then "" else "    " <> name <> ".drop_explicit();\\n"
        valTy = inferTypeExpr currentMod aritiesMap bound val
        newBound = Map.insert name valTy bound
    in
    "{\\n" <>
    "    let mut " <> name <> " = " <> valCode <> ";\\n" <>
    deadCode <>
    "    " <> codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap newBound alive inEffectBlock body <> "\\n" <>
    "}"`);

// Patch EffectBind in codegenExpr_
code = code.replace(/        bodyVars = freeVariables body\n        deadCode = if Set\.member name bodyVars then "" else "    " <> name <> "\.drop_explicit\(\);\\n"\n    in\n    "{\\n" <>\n    "    let mut " <> name <> " = " <> valCode <> ";\\n" <>\n    deadCode <>\n    "    " <> codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive inEffectBlock body <> "\\n" <>\n    "}"/g,
`        bodyVars = freeVariables body
        deadCode = if Set.member name bodyVars then "" else "    " <> name <> ".drop_explicit();\\n"
        valTy = inferTypeExpr currentMod aritiesMap bound val
        newBound = Map.insert name valTy bound
    in
    "{\\n" <>
    "    let mut " <> name <> " = " <> valCode <> ";\\n" <>
    deadCode <>
    "    " <> codegenExpr_ currentMod allZeroArity allMacroBindings mbLoop aritiesMap newBound alive inEffectBlock body <> "\\n" <>
    "}"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
