const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
  'isZeroArity = case ty of\n        Func _ _ -> false\n        _ -> true',
  'isZeroArity = false /* Temp */'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
