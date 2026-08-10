const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const isZeroArity = (() => {\n      if (v._1._1.tag === "Func") {\n        return false;\n      }\n      return true;\n    })();',
  'const isZeroArity = (() => {\n      if (v._1._2._2 === "intersectBy") console.log("EVALUATING isZeroArity for intersectBy. ty.tag:", v._1._1.tag);\n      if (v._1._1.tag === "Func") {\n        return false;\n      }\n      return true;\n    })();'
);

fs.writeFileSync('bin/purust.js', code);
