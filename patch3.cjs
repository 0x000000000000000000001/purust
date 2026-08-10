const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Fix Unsupported Op1
code = code.replace(
  /_ -> "\/\/ Unsupported Op1"/g,
  `_ -> "unimplemented!() /* Unsupported Op1 */"`
);

// Fix Unsupported Op2
code = code.replace(
  /_ -> "\/\/ Unsupported Op2"/g,
  `_ -> "unimplemented!() /* Unsupported Op2 */"`
);

// Fix Unsupported Expr
code = code.replace(
  /_ -> "\/\/ Unsupported Expr: " <> printAST inner/g,
  `_ -> "unimplemented!() /* Unsupported Expr: " <> printAST inner <> " */"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
