import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /let subsequent = Array\.drop \(i \+ 1\) fields\s+aliveForV = Set\.union alive \(Array\.foldl Set\.union Set\.empty \(map \(\\\(Tuple _ sv\) -> freeVariables sv\) subsequent\)\)\s+in codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForV false val/,
    `let subsequent = Array.drop (i + 1) fields
                aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\\(Tuple _ sv) -> freeVariables sv) subsequent))
                valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap bound aliveForV false val
                valTyStr = extractFinalRetType (codegenExprType currentMod aritiesMap bound val)
            in boxUnbox Any valTyStr valCode`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
