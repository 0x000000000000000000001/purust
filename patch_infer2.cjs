const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/inferredTy = inferTypeExpr modNameStr aritiesMap expr/m, 'inferredTy = inferTypeExpr modNameStr aritiesMap Map.empty expr');

fs.writeFileSync(file, code);
