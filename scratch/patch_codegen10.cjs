const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'if (fullName === "Control_Monad_ST_Internal_modifyImpl") console.log("modifyImpl type tag:", v._1._1.tag, JSON.stringify(v._1._1, null, 2));\n    const isZeroArity = (() => {\\n      if (v._1._1.tag === "Func") {',
  'if (fullName.includes("modifyImpl")) console.log("modifyImpl found! tag:", v._1._1.tag, JSON.stringify(v._1._1, null, 2));\n    const isZeroArity = (() => {\n      if (v._1._1.tag === "Func") {'
);

fs.writeFileSync('bin/purust.js', code);
