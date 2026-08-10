const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const v = extractVarType(e);',
  'const v = extractVarType(e);\n  if (e.tag === "NeutralExpr" && e._1.tag === "App" && e._1._1.tag === "NeutralExpr" && e._1._1._1.tag === "Var" && e._1._1._1._1._2._2 === "intersectBy") console.log("App intersectBy without Typed!!!");'
);

fs.writeFileSync('bin/purust.js', code);
