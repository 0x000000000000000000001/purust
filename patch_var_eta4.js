import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'fnTy = fromMaybe Any (Map.lookup originalName aritiesMap)',
    'fnTy = fromMaybe Any (Map.lookup key aritiesMap)'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
