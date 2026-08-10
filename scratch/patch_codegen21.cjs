const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'const modNameStr = replaceAll(".")("_")(backendMod.name);',
  'const modNameStr = replaceAll(".")("_")(backendMod.name);\nconsole.log("Compiling module: ", backendMod.name);'
);

fs.writeFileSync('bin/purust.js', code);
