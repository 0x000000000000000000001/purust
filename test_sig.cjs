const fs = require('fs');
let fullCode = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');
const sigRegex = /pub fn ([a-zA-Z0-9_]+)\((.*?)\) -> (?:crate::)?UnknownType/g;
let signatures = {};
let match;
while ((match = sigRegex.exec(fullCode)) !== null) {
    const fnName = match[1];
    const argsStr = match[2].trim();
    if (argsStr.length === 0) {
        signatures[fnName] = [];
        continue;
    }
    let args = [];
    let currentArg = "";
    let depth = 0;
    for (let i = 0; i < argsStr.length; i++) {
        let c = argsStr[i];
        if (c === '<' || c === '(') depth++;
        if (c === '>' || c === ')') depth--;
        if (c === ',' && depth === 0) {
            args.push(currentArg.trim());
            currentArg = "";
        } else {
            currentArg += c;
        }
    }
    if (currentArg.trim().length > 0) args.push(currentArg.trim());
    
    signatures[fnName] = args.map(a => {
        let colonIdx = a.indexOf(':');
        let ty = a.substring(colonIdx + 1).trim();
        if (ty.startsWith('crate::')) ty = ty.substring(7);
        return ty;
    });
}
console.log(signatures['Unsafe_Coerce_unsafeCoerce']);
