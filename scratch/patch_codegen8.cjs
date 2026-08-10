const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
  'let fnCode = codegenExpr modNameStr allZeroArity allMacroBindings mbLoop (Map.union bound aritiesMap) Set.empty innerExpr',
  'let fnCode = codegenExpr modNameStr allZeroArity allMacroBindings mbLoop (Map.union bound aritiesMap) Set.empty expr'
);

code = code.replace(
  `else codegenExpr modNameStr allZeroArity allMacroBindings Nothing (Map.union bound aritiesMap) Set.empty innerExpr`,
  `else codegenExpr modNameStr allZeroArity allMacroBindings Nothing (Map.union bound aritiesMap) Set.empty expr`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
