const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');
const appRegex = /in if fnArity > numProvided then\n\s+let numMissing = fnArity - numProvided\n\s+missingVars = Array.mapWithIndex \(\\\\i _ -> "c_" <> show i\) \(Array.replicate numMissing unit\)\n\s+missingArgs = String.joinWith ", " \(map \(\\\\v -> "mut " <> v <> ": UnknownType"\) missingVars\)\n\s+closureArgs = String.joinWith ", " \(argsCodeArray <> missingVars\)\n\s+in "std::rc::Rc::new\(move \\\|" <> missingArgs <> "\\\| \(" <> fnCode <> "\)\(" <> closureArgs <> "\)\)"\n\s+else\n\s+"\(" <> fnCode <> "\)\(" <> argsCode <> "\)"/;

console.log("Matched appRegex:", code.match(appRegex) !== null);
