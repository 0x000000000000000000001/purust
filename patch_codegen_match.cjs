const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Replace "match " <> valName <> ".dup() {" with "match &*" <> valName <> " {"
code = code.replace(
    /"match " <> valName <> "\.dup\(\) \{"/g,
    `"match &*" <> valName <> " {"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
