const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const startStr = '    let isFunc = case fnTy of';
const endStr = '         "(" <> fnCode <> ".fn" <> show numProvided <> ".clone().unwrap())(" <> argsCode <> ")"';

let startIndex = code.indexOf(startStr);
let endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + '    in if fnArity > numProvided then\n         let numMissing = fnArity - numProvided\n             missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)\n             missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)\n             closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)\n         in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"\n       else\n         "(" <> fnCode <> ")(" <> argsCode <> ")"' + code.substring(endIndex + endStr.length);
}

const origStart = '    in if fnArity > numProvided then\n         let numMissing = fnArity - numProvided';
const origEnd = '       else\n         "(" <> fnCode <> ")(" <> argsCode <> ")"';

startIndex = code.indexOf(origStart);
endIndex = code.indexOf(origEnd, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find block to replace!");
    process.exit(1);
}

const before = code.substring(0, startIndex);
const after = code.substring(endIndex + origEnd.length);

const newApp = `        isFunc = case fnTy of
          Func _ _ -> true
          _ -> false
    in if isFunc && fnArity > numProvided then
         let numMissing = fnArity - numProvided
             missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
             missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
             closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
         in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"
       else if isFunc then
         "(" <> fnCode <> ")(" <> argsCode <> ")"
       else
         "(" <> fnCode <> ".fn" <> show numProvided <> ".clone().unwrap())(" <> argsCode <> ")"`;

code = before + newApp + after;
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Patched successfully!");
