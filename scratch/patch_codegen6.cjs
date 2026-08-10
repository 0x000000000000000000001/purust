const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /Nothing -> case e of\n    NeutralExpr expr -> case expr of\n  Typed/;
code = code.replace(/  Typed/g, '      Typed');
code = code.replace(/  App/g, '      App');
code = code.replace(/  Lit/g, '      Lit');
code = code.replace(/  Var/g, '      Var');
code = code.replace(/  Let/g, '      Let');
code = code.replace(/  Local/g, '      Local');
code = code.replace(/  Abs/g, '      Abs');
code = code.replace(/  EffectBind/g, '      EffectBind');
code = code.replace(/  EffectPure/g, '      EffectPure');
code = code.replace(/  PrimUndefined/g, '      PrimUndefined');
code = code.replace(/  CtorSaturated/g, '      CtorSaturated');
code = code.replace(/  CtorDef/g, '      CtorDef');
code = code.replace(/  UncurriedEffectApp/g, '      UncurriedEffectApp');
code = code.replace(/  Accessor/g, '      Accessor');
code = code.replace(/  _ -> "unimplemented/g, '      _ -> "unimplemented');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
