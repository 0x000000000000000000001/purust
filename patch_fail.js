import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/      Fail _ -> "\{ let _t: crate::UnknownType = unimplemented!\(\); _t \} \/\* Unsupported Expr: Fail\(Failed pattern match\) \*\/"/,
`      Fail _ -> "unimplemented!() /* Unsupported Expr: Fail(Failed pattern match) */"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
