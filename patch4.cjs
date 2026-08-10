const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
  /_ -> "\/\/ Unsupported Expr: " <> printAST \(NeutralExpr expr\)/,
  `_ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> " */"`
);

code = code.replace(
  /_ -> "\/\/ Unsupported UncurriedEffectApp with fn: " <> printAST fn <> "\\n"/,
  `_ -> "unimplemented!() /* Unsupported UncurriedEffectApp with fn: " <> printAST fn <> " */\\n"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
