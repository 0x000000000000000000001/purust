import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '  Typed Any inner -> inferTypeExpr currentMod aritiesMap bound inner',
    '  Typed Any inner -> inferTypeExpr currentMod aritiesMap bound inner\n  Typed ty _ -> ty'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
