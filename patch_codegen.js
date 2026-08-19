import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    'argsCodeArray = map (\\p -> sanitizeIdent p <> ".clone()") deduped',
    'argsCodeArray = Array.mapWithIndex (\\i p -> let ty = fromMaybe Any (Array.index argTypes i) in boxUnbox Any ty (sanitizeIdent p <> ".clone()")) deduped'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
