import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> ")"',
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> " /* aTy: " <> codegenExprType true aTy <> " */)"'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
