const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/retType = case innerExpr of\n\s*NeutralExpr \(Typed \(Func _ ret\) _\) -> ret/m, 'retType = case expr of\n                  NeutralExpr (Typed (Func _ ret) _) -> ret');

fs.writeFileSync(file, code);
