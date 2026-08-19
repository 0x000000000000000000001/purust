import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '  Let _ _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner\n  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner',
    '  Let _ _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner\n  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner\n  EffectBind _ _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner\n  EffectPure inner -> inferTypeExpr currentMod aritiesMap bound inner\n  EffectDefer inner -> inferTypeExpr currentMod aritiesMap bound inner'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
