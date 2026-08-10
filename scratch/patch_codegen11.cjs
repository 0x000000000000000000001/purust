const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const isZeroArity = (() => {\\n      if (v._1._1.tag === "Func") {',
  ''
); // cleanup old attempt if it existed
code = code.replace(
  /const isZeroArity = \(\(\) => \{\n      if \(v\._1\._1\.tag === "Func"\) \{/g,
  'if (fullName.includes("modifyImpl")) console.log("modifyImpl found! tag:", v._1._1.tag, JSON.stringify(v._1._1, null, 2));\n    const isZeroArity = (() => {\n      if (v._1._1.tag === "Func") {'
);

fs.writeFileSync('bin/purust.js', code);
