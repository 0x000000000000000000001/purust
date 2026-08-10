const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Patch LitString
const litStr = '    LitString s -> "unsafe_coerce(\\"" <> s <> "\\")"';
const newLitStr = '    LitString s -> "unsafe_coerce(r#\\"" <> s <> "\\"#)"';
code = code.replace(litStr, newLitStr);

// Patch sanitizeIdent
code = code.replace(/else if s2 == "use" then "use_kw"/, 
    'else if s2 == "use" then "use_kw"\n     else if s2 == "break" then "break_kw"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
