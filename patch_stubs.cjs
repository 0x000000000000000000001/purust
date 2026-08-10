const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/"pub fn Effect_Console_log<T>\(_: T\) -> UnknownType \{ unsafe_coerce\(0\) \}\\n\\n" <>\n/g, "");
code = code.replace(/"pub fn Control_Bind_discardUnit\(\) -> UnknownType \{ [^"]+ \}\\n" <>\n/g, "");
code = code.replace(/"pub fn Effect_bindEffect\(\) -> UnknownType \{ unsafe_coerce\(0\) \}\\n" <>\n/g, "");
code = code.replace(/"pub fn Data_Show_showString\(\) -> UnknownType \{ [^"]+ \}\\n\\n" <>\n/g, "");

fs.writeFileSync('src/Purust/CodeGen.purs', code);
