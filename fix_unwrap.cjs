const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. Fix mk_int
code = code.replace(/a: val/, 'a: Some(val)');

// 2. Fix OpIntNum to use .unwrap()
code = code.replace('OpIntNum OpAdd -> "mk_int((" <> aStr <> ").a + (" <> bStr <> ").a)"', 'OpIntNum OpAdd -> "mk_int((" <> aStr <> ").a.unwrap() + (" <> bStr <> ").a.unwrap())"');
code = code.replace('OpIntNum OpSubtract -> "mk_int((" <> aStr <> ").a - (" <> bStr <> ").a)"', 'OpIntNum OpSubtract -> "mk_int((" <> aStr <> ").a.unwrap() - (" <> bStr <> ").a.unwrap())"');
code = code.replace('OpIntNum OpMultiply -> "mk_int((" <> aStr <> ").a * (" <> bStr <> ").a)"', 'OpIntNum OpMultiply -> "mk_int((" <> aStr <> ").a.unwrap() * (" <> bStr <> ").a.unwrap())"');
code = code.replace('OpIntNum OpDivide -> "mk_int((" <> aStr <> ").a / (" <> bStr <> ").a)"', 'OpIntNum OpDivide -> "mk_int((" <> aStr <> ").a.unwrap() / (" <> bStr <> ").a.unwrap())"');

// 3. Fix OpIntOrd to use .unwrap()
code = code.replace('OpIntOrd OpEq -> "crate::mk_bool((" <> aStr <> ").a == (" <> bStr <> ").a)"', 'OpIntOrd OpEq -> "crate::mk_bool((" <> aStr <> ").a.unwrap() == (" <> bStr <> ").a.unwrap())"');

fs.writeFileSync('src/Purust/CodeGen.purs', code);
