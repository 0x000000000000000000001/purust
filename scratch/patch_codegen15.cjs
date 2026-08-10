const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

code = code.replace(
  'var codegenBindingGroup = (currentMod) => (groupArities) => (allZeroArity) => (allMacroBindings) => (bindings) => {',
  'var codegenBindingGroup = (currentMod) => (groupArities) => (allZeroArity) => (allMacroBindings) => (bindings) => {\n  const bindingsStr = JSON.stringify(bindings);\n  if (bindingsStr.includes("modifyImpl")) console.log("codegenBindingGroup got bindings with modifyImpl! bindings:", bindingsStr.substring(0, 500));'
);

fs.writeFileSync('bin/purust.js', code);
