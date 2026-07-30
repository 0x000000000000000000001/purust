const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

// Fix the call inside App
code = code.replace(/fnTy = inferTypeExpr currentMod aritiesMap bound fn/m, 'fnTy = inferTypeExpr currentMod Map.empty bound fn');

fs.writeFileSync(file, code);
