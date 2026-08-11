const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replacement = `      varCode = if isZeroArity then fullName <> "()" else "__PURUST_VAR__!(" <> fullName <> ")"`;
code = code.replace(`      varCode = if isZeroArity then fullName <> "()" else fullName`, replacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed varCode in CodeGen.purs");
