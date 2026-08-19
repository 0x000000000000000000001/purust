import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/  _ -> "\{ let _t: crate::UnknownType = unimplemented!\(\); _t \} \/\* Unsupported Expr: " <> printAST expr <> " \*\/"/,
`  Fail _ -> "unimplemented!() /* Unsupported Expr: Fail */"\n  _ -> "{ let _t: crate::UnknownType = unimplemented!(); _t } /* Unsupported Expr: " <> printAST expr <> " */"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
