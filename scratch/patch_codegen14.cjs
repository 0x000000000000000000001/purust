const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'if (e && e.tag === "Typed" && e._2 && e._2.tag === "Var" && e._2._1.value0 && e._2._1.value0.identifier === "modifyImpl") console.log("codegenExpr got modifyImpl! e:", JSON.stringify(e, null, 2));',
  'if (JSON.stringify(e).includes("modifyImpl")) console.log("codegenExpr got e with modifyImpl:", JSON.stringify(e, null, 2));'
);

fs.writeFileSync('bin/purust.js', code);
