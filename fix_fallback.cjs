const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/  _ -> "unimplemented!\(\) \/\* Unsupported Expr: " <> printAST \(NeutralExpr expr\) <> " \*\/"/, 
  '  _ -> Debug.trace ("FALLBACK HIT FOR: " <> printAST (NeutralExpr expr)) \\_ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> " */"');

// Ensure Debug is imported
if (!code.includes('import Debug as Debug')) {
  code = code.replace(/module Purust.CodeGen where/, 'module Purust.CodeGen where\nimport Debug as Debug');
}

fs.writeFileSync('src/Purust/CodeGen.purs', code);
