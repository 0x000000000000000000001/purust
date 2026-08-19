import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'retTy = fromMaybe Any (Array.last expectedArgTys)',
    'retTy = extractFinalRetType fnTy'
);
code = code.replace(
    'retTy = fromMaybe Any (Array.last expectedArgTys)',
    'retTy = extractFinalRetType fnTy'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
