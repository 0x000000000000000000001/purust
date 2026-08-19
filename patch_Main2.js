import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');

code = code.replace(
    '                    let retTyStr',
    '                    retTyStr'
);
code = code.replace(
    '                    let defaultRet',
    '                    defaultRet'
);

fs.writeFileSync('src/Main.purs', code);
