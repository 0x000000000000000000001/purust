import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '    OpBooleanOrd _ -> Boolean',
    '    OpBooleanOrd _ -> Boolean\n    OpIntOrd _ -> Boolean\n    OpNumberOrd _ -> Boolean\n    OpStringOrd _ -> Boolean\n    OpCharOrd _ -> Boolean'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
