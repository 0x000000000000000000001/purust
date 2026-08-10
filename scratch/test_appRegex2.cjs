const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regexStr = 'in if fnArity > numProvided then[\\\\s\\\\S]*?\\"\\(" <> fnCode <> "\\)\\(" <> argsCode <> "\\)"';
const match = code.match(new RegExp(regexStr));
console.log(match ? "Matched!" : "Failed!");
if (match) {
    const textToReplace = match[0];
    const newApp = `isFunc = case fnTy of
           Func _ _ -> true
           _ -> false
    in if isFunc && fnArity > numProvided then
         let numMissing = fnArity - numProvided
             missingVars = Array.mapWithIndex (\\\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
             missingArgs = String.joinWith ", " (map (\\\\v -> "mut " <> v <> ": UnknownType") missingVars)
             closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
         in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"
       else if isFunc then
         "(" <> fnCode <> ")(" <> argsCode <> ")"
       else
         "(" <> fnCode <> ".fn" <> show numProvided <> ".clone().unwrap())(" <> argsCode <> ")"`;
         
    code = code.replace(textToReplace, newApp);
    fs.writeFileSync('src/Purust/CodeGen.purs', code);
    console.log("Patched!");
}

