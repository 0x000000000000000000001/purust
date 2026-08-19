import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      _ -> genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn args',
    '      _ -> \n        let appTy = inferTypeExpr currentMod aritiesMap bound (NeutralExpr (UncurriedEffectApp fn args))\n        in genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn args'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
