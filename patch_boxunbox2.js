import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/      -- debug = Debug\.trace \("boxUnbox: exp=" <> expStr <> ", act=" <> actStr <> " for code=" <> code\) \\_ -> unit/,
`      debug = Debug.trace ("boxUnbox: exp=" <> expStr <> ", act=" <> actStr <> " for code=" <> code) \\_ -> unit`);

// I also need to evaluate `debug`!
code = code.replace(/    if expStr == actStr then code/,
`    if expStr == actStr then let _ = debug in code`);

code = code.replace(/    else if expStr == "i64" && actStr == "crate::UnknownType" then "\(" <> code <> "\)\.init_int\.unwrap\(\)"/,
`    else if expStr == "i64" && actStr == "crate::UnknownType" then let _ = debug in "(" <> code <> ").init_int.unwrap()"`);

code = code.replace(/    else if expStr == "crate::UnknownType" && actStr == "i64" then "crate::mk_int\(" <> code <> "\)"/,
`    else if expStr == "crate::UnknownType" && actStr == "i64" then let _ = debug in "crate::mk_int(" <> code <> ")"`);

code = code.replace(/    else if expStr == "bool" && actStr == "crate::UnknownType" then "\(" <> code <> "\)\.init_bool\.unwrap\(\)"/,
`    else if expStr == "bool" && actStr == "crate::UnknownType" then let _ = debug in "(" <> code <> ").init_bool.unwrap()"`);

code = code.replace(/    else if expStr == "crate::UnknownType" && actStr == "bool" then "crate::mk_bool\(" <> code <> "\)"/,
`    else if expStr == "crate::UnknownType" && actStr == "bool" then let _ = debug in "crate::mk_bool(" <> code <> ")"`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
