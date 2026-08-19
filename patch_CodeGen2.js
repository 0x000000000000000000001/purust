import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'module Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, codegenExprType) where',
    'module Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, extractFinalRetType, codegenExprType) where'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
