const fs = require('fs');
let code = fs.readFileSync('bundle.cjs', 'utf8');

const regex = /const finalBundle = \(\(\(unknownDef \+ dynamicRecordA \+ cleanedContent\)\.split\('crate::UnknownType::new\\(0\\)'\)\.join\('crate::mk_int\\(0\\)'\)\)\);/;
const replacement = `let fullCode = (unknownDef + dynamicRecordA + cleanedContent).split('crate::UnknownType::new(0)').join('crate::mk_int(0)');

// First pass: extract all function signatures
const signatures = {};
const fnRegex = /pub fn ([a-zA-Z0-9_]+)\\((.*?)\\)/g;
let match;
while ((match = fnRegex.exec(fullCode)) !== null) {
    const name = match[1];
    const argsStr = match[2];
    const args = argsStr.split(',').filter(x => x.trim().length > 0).map(x => {
        let ty = x.split(':')[1].trim();
        return ty;
    });
    signatures[name] = args;
}

// Second pass: resolve __PURUST_APP__!
const appRegex = /__PURUST_APP__!\\((.*?), \\[(.*?)\\]\\)/g;
fullCode = fullCode.replace(appRegex, (fullMatch, fnName, argsStr) => {
    // We only process if fnName is a simple identifier and we have its signature
    fnName = fnName.trim();
    if (fnName.startsWith('(') && fnName.endsWith(')')) {
        fnName = fnName.slice(1, -1);
    }
    
    // Parse arguments: they might contain commas, but let's assume they are separated by ", "
    // Actually argsStr is joined by ", " in CodeGen.purs
    let rawArgs = [];
    if (argsStr.trim().length > 0) {
        // A simple split by ", " works if inner code doesn't have ", "
        // But let's just split by "/*ty*/, " to be safe
        rawArgs = argsStr.split(/\\*\\/, /).map(x => x.trim()).filter(x => x.length > 0);
        // Add the trailing "/*ty*/" back except for the last element which already has it (handled below)
    }
    
    // Let's use a better parsing for argsStr based on the /*ty*/ marker
    let parsedArgs = [];
    let argRegex = /(.*?)\\s*\\/\\*(bool|i64|f64|str|unk)\\*\\//g;
    let argMatch;
    while ((argMatch = argRegex.exec(argsStr)) !== null) {
        let code = argMatch[1];
        if (code.startsWith(', ')) code = code.slice(2);
        parsedArgs.push({ code: code.trim(), ty: argMatch[2] });
    }
    
    if (signatures[fnName]) {
        let expectedTypes = signatures[fnName];
        if (expectedTypes.length === parsedArgs.length) {
            let finalArgs = parsedArgs.map((arg, i) => {
                let exp = expectedTypes[i];
                if (exp === 'UnknownType' && arg.ty === 'i64') return 'crate::mk_int(' + arg.code + ')';
                if (exp === 'UnknownType' && arg.ty === 'bool') return 'crate::mk_bool(' + arg.code + ')';
                // if it expects i64 and we have unk, we can't unbox easily here without .a, but let's hope it matches
                if (exp === 'i64' && arg.ty === 'unk') return '(' + arg.code + ').a';
                if (exp === 'bool' && arg.ty === 'unk') return '(' + arg.code + ').init_bool.unwrap()'; // hack
                return arg.code;
            });
            return fnName + '(' + finalArgs.join(', ') + ')';
        }
    }
    
    // Fallback: unroll closures!
    let acc = fnName;
    for (let arg of parsedArgs) {
        let argCode = arg.code;
        if (arg.ty === 'i64') argCode = 'crate::mk_int(' + argCode + ')';
        if (arg.ty === 'bool') argCode = 'crate::mk_bool(' + argCode + ')';
        acc = '(' + acc + ').call.clone().unwrap()(' + argCode + ')';
    }
    return acc;
});

// Since __PURUST_APP__ can be nested, we need to run it multiple times until no matches
while (fullCode.match(/__PURUST_APP__!/)) {
    fullCode = fullCode.replace(appRegex, (fullMatch, fnName, argsStr) => {
        fnName = fnName.trim();
        if (fnName.startsWith('(') && fnName.endsWith(')')) {
            fnName = fnName.slice(1, -1);
        }
        let parsedArgs = [];
        let argRegex = /(.*?)\\s*\\/\\*(bool|i64|f64|str|unk)\\*\\//g;
        let argMatch;
        while ((argMatch = argRegex.exec(argsStr)) !== null) {
            let code = argMatch[1];
            if (code.startsWith(', ')) code = code.slice(2);
            parsedArgs.push({ code: code.trim(), ty: argMatch[2] });
        }
        
        if (signatures[fnName]) {
            let expectedTypes = signatures[fnName];
            if (expectedTypes.length === parsedArgs.length) {
                let finalArgs = parsedArgs.map((arg, i) => {
                    let exp = expectedTypes[i];
                    if (exp === 'UnknownType' && arg.ty === 'i64') return 'crate::mk_int(' + arg.code + ')';
                    if (exp === 'UnknownType' && arg.ty === 'bool') return 'crate::mk_bool(' + arg.code + ')';
                    if (exp === 'i64' && arg.ty === 'unk') return '(' + arg.code + ').a';
                    return arg.code;
                });
                return fnName + '(' + finalArgs.join(', ') + ')';
            }
        }
        
        let acc = fnName;
        for (let arg of parsedArgs) {
            let argCode = arg.code;
            if (arg.ty === 'i64') argCode = 'crate::mk_int(' + argCode + ')';
            if (arg.ty === 'bool') argCode = 'crate::mk_bool(' + argCode + ')';
            acc = '(' + acc + ').call.clone().unwrap()(' + argCode + ')';
        }
        return acc;
    });
}

const finalBundle = fullCode;`;

if (!code.match(regex)) {
    console.error("Could not find bundle finalBundle regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('bundle.cjs', code);
console.log("Fixed bundle.cjs with __PURUST_APP__ resolver!");
