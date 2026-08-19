import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '      in "vec![" <> String.joinWith ", " arrCode <> "]"',
    '      in "crate::mk_array(vec![" <> String.joinWith ", " arrCode <> "])"'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
