import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');

code = code.replace(
    'import Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, codegenExprType)',
    'import Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, extractFinalRetType, codegenExprType)'
);

fs.writeFileSync('src/Main.purs', code);
