import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn args\n  UncurriedEffectApp fn args ->',
    'genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive appTy fn args\n  UncurriedEffectApp fn args ->'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
