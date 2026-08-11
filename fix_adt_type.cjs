const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/ADT name _ -> String\.joinWith "_" name/, 'ADT name _ -> "UnknownType"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
