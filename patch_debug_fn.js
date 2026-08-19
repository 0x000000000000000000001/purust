import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> " /* aTy: " <> codegenExprType true aTy <> " */)"',
    '      OpBooleanNot -> "!(" <> boxUnbox Boolean aTy aStrRaw <> " /* aTy: " <> codegenExprType true aTy <> ", a is " <> printAST a <> " */)"'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
