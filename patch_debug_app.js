import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      _ -> case unwrapType (inferTypeExpr currentMod aritiesMap bound fn) of',
    '      _ -> case unwrapType (inferTypeExpr currentMod aritiesMap bound fn) of'
);
// I will just use sed to patch it because it is multi-line
