import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'else if expStr == "String" && actStr == "crate::UnknownType" then "(" <> code <> ").init_string.clone().unwrap()"',
    `else if expStr == "char" && actStr == "crate::UnknownType" then "(" <> code <> ").init_char.unwrap()"
    else if expStr == "crate::UnknownType" && actStr == "char" then "crate::mk_char(" <> code <> ")"
    else if expStr == "String" && actStr == "crate::UnknownType" then "(" <> code <> ").init_string.clone().unwrap()"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
