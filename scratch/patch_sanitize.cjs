const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/else if s2 == "break" then "break_kw"/, 
    'else if s2 == "break" then "break_kw"\n     else if s2 == "mod" then "mod_kw"\n     else if s2 == "as" then "as_kw"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
