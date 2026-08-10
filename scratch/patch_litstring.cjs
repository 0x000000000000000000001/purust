const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/LitString s -> "unsafe_coerce\\(\\\\\\"" <> s <> "\\\\\\""\\)"/g, 
    'LitString s -> "unsafe_coerce(r#\\"" <> s <> "\\"#)"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
