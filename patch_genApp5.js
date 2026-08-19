import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /inferTypeExpr currentMod aritiesMap bound \(App fn args\)/g,
    'inferTypeExpr currentMod aritiesMap bound (NeutralExpr (App fn args))'
);

code = code.replace(
    /inferTypeExpr currentMod aritiesMap bound \(UncurriedApp fn args\)/g,
    'inferTypeExpr currentMod aritiesMap bound (NeutralExpr (UncurriedApp fn args))'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
