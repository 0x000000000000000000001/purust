const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const replacement = `  _ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> ", freeVars: " <> String.joinWith ", " (Set.toUnfoldable (freeVariables (NeutralExpr expr)) :: Array String) <> " */"`;

code = code.replace(`  _ -> "unimplemented!() /* Unsupported Expr: " <> printAST (NeutralExpr expr) <> " */"`, replacement);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
