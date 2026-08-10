const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const v = extractVarType(e);\n  if (v.tag === "Just" && JSON.stringify(v).includes("intersectBy")) console.log("intersectBy v:", JSON.stringify(v, null, 2));',
  'const v = extractVarType(e);\n  if (v.tag === "Just" && v._1._2._2 === "intersectBy") console.log("INTERSECTBY MATCHED!");'
);

fs.writeFileSync('bin/purust.js', code);
