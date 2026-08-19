import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/  Branch _ _ -> Any/,
`  Branch _ def -> inferTypeExpr currentMod aritiesMap bound def`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
