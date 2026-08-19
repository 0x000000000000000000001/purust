import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /boxUnbox Any appTy callResult/g,
    'boxUnbox appTy Any callResult'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
