const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const v = extractVarType(e);',
  'const v = extractVarType(e);\n  if (JSON.stringify(e).includes("intersectBy")) console.log("intersectBy IN AST e!", JSON.stringify(e).substring(0, 200));'
);

fs.writeFileSync('bin/purust.js', code);
