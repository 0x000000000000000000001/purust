const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const varCode = v._1._1.tag !== "Func" ? fullName + "()" : fullName;',
  'if (fullName.includes("modifyImpl")) console.log("modifyImpl found! tag:", v._1._1.tag, JSON.stringify(v._1._1, null, 2));\n    const varCode = v._1._1.tag !== "Func" ? fullName + "()" : fullName;'
);

fs.writeFileSync('bin/purust.js', code);
