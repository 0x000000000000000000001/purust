const fs = require('fs');
let fullCode = fs.readFileSync('output-test/app/src/main.rs', 'utf8');

function parseArgs(argsStr) {
    let args = [];
    let depth = 0;
    let currentArg = "";
    
    // Replace -> with spaces so > doesn't mess up depth
    let cleanStr = argsStr.replace(/->/g, "  ");
    for (let i = 0; i < argsStr.length; i++) {
        let c = cleanStr[i];
        if (c === '<' || c === '(') depth++;
        if (c === '>' || c === ')') depth--;
        if (argsStr[i] === ',' && depth === 0) {
            args.push(currentArg.trim());
            currentArg = "";
        } else {
            currentArg += argsStr[i];
        }
    }
    if (currentArg.trim().length > 0) args.push(currentArg.trim());
    return args.map(a => {
        let colonIdx = a.indexOf(':');
        if (colonIdx !== -1) return a.slice(colonIdx + 1).trim();
        return a;
    });
}

const signatures = {};
let fnPrefix = 'pub fn ';
let pos = 0;
while (true) {
    let idx = fullCode.indexOf(fnPrefix, pos);
    if (idx === -1) break;
    
    let nameStart = idx + fnPrefix.length;
    let nameEnd = fullCode.indexOf('(', nameStart);
    if (nameEnd === -1) break;
    
    let name = fullCode.slice(nameStart, nameEnd).trim();
    if (name.includes('<')) name = name.slice(0, name.indexOf('<')).trim();
    
    let depth = 0;
    let argsStart = nameEnd + 1;
    let argsEnd = argsStart;
    for (let i = nameEnd; i < fullCode.length; i++) {
        if (fullCode[i] === '(') depth++;
        if (fullCode[i] === ')') {
            depth--;
            if (depth === 0) {
                argsEnd = i;
                break;
            }
        }
    }
    
    let argsStr = fullCode.slice(argsStart, argsEnd);
    let args = parseArgs(argsStr);
    signatures[name] = args;
    
    if (name.includes('Data_Array_zipWith')) {
        console.log(name, args);
    }
    
    pos = argsEnd;
}
