import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner',
    '  Let _ _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner\n  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
