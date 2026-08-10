const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. Fix LitString
code = code.replace(/LitString s -> "unsafe_coerce\(\\"" <> s <> "\\"\)"/,
`LitString s -> "unsafe_coerce(r#\\"" <> s <> "\\"#)"`);

// 2. Add 'gen' to sanitizeIdent
code = code.replace(/else if s2 == "as" then "as_kw"/,
`else if s2 == "as" then "as_kw"
     else if s2 == "gen" then "gen_kw"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
