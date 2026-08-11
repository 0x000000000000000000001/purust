const fs = require('fs');

let bundleCode = fs.readFileSync('tests/runner/bundle.cjs', 'utf8');

// First replacement chunk
bundleCode = bundleCode.replace(
    /    if \(signatures\[fnName\]\) \{\n        let expectedTypes = signatures\[fnName\];\n        if \(expectedTypes\.length === parsedArgs\.length\) \{\n            let finalArgs = parsedArgs\.map\(\(arg, i\) => \{\n                let exp = expectedTypes\[i\];\n                if \(exp === 'UnknownType' && arg\.ty === 'i64'\) return 'crate::mk_int\\(' \+ arg\.code \+ '\\)';\n                if \(exp === 'UnknownType' && arg\.ty === 'bool'\) return 'crate::mk_bool\\(' \+ arg\.code \+ '\\)';\n                if \(exp === 'i64' && arg\.ty === 'unk'\) return '\\(' \+ arg\.code \+ '\\)\.a';\n                if \(exp === 'bool' && arg\.ty === 'unk'\) return '\\(' \+ arg\.code \+ '\\)\.init_bool\.unwrap\\(\\)'; \/\/ hack for now\n                return arg\.code;\n            \}\);\n            return fnName \+ '\\(' \+ finalArgs\.join\\(', '\\) \+ '\\)';\n        \}\n    \}/,
    `    if (signatures[fnName]) {
        let expectedTypes = signatures[fnName];
        let providedArgsLength = parsedArgs.length;
        
        let finalArgs = parsedArgs.map((arg, i) => {
            let exp = expectedTypes[i];
            if (!exp) return arg.code; // Fallback if too many args
            if (exp === 'UnknownType' && arg.ty === 'i64') return 'crate::mk_int(' + arg.code + ')';
            if (exp === 'UnknownType' && arg.ty === 'bool') return 'crate::mk_bool(' + arg.code + ')';
            if (exp === 'i64' && arg.ty === 'unk') return '(' + arg.code + ').a';
            if (exp === 'bool' && arg.ty === 'unk') return '(' + arg.code + ').init_bool.unwrap()'; // hack for now
            return arg.code;
        });

        if (expectedTypes.length === providedArgsLength) {
            return fnName + '(' + finalArgs.join(', ') + ')';
        } else if (expectedTypes.length > providedArgsLength) {
            // Eta-expansion for partial application!
            let missingCount = expectedTypes.length - providedArgsLength;
            let code = fnName + '(' + finalArgs.join(', ') + (finalArgs.length > 0 ? ', ' : '');
            let etaArgs = [];
            for (let i = 0; i < missingCount; i++) {
                let exp = expectedTypes[providedArgsLength + i];
                let tyStr = exp;
                if (exp === 'UnknownType') {
                    etaArgs.push('mut eta_' + i + ': UnknownType');
                    code += 'eta_' + i + '.clone()';
                } else if (exp === 'i64') {
                    etaArgs.push('mut eta_' + i + ': i64');
                    code += 'eta_' + i;
                } else if (exp === 'bool') {
                    etaArgs.push('mut eta_' + i + ': bool');
                    code += 'eta_' + i;
                } else {
                    etaArgs.push('mut eta_' + i + ': ' + exp);
                    code += 'eta_' + i + '.clone()';
                }
                if (i < missingCount - 1) code += ', ';
            }
            code += ')';
            
            // Wrap in closures
            for (let i = missingCount - 1; i >= 0; i--) {
                code = 'perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |' + etaArgs[i] + '| -> UnknownType { ' + code + ' })), ..Default::default() })';
            }
            return code;
        } else {
            // Over-applied: call the function, then unwrap the returned closures
            let acc = fnName + '(' + finalArgs.slice(0, expectedTypes.length).join(', ') + ')';
            for (let i = expectedTypes.length; i < parsedArgs.length; i++) {
                let arg = parsedArgs[i];
                let argCode = arg.code;
                if (arg.ty === 'i64') argCode = 'crate::mk_int(' + argCode + ')';
                if (arg.ty === 'bool') argCode = 'crate::mk_bool(' + argCode + ')';
                acc = '(' + acc + ').call.clone().unwrap()(' + argCode + ')';
            }
            return acc;
        }
    }`
);

// Second replacement chunk
bundleCode = bundleCode.replace(
    /while \(fullCode\.match\(\/__PURUST_APP__!\/\)\) \{\n    fullCode = fullCode\.replace\(appRegex, resolveApp\);\n\}\n\nconst finalBundle = fullCode;/,
    `let lastCode = "";
while (fullCode.match(/__PURUST_APP__!/) && fullCode !== lastCode) {
    lastCode = fullCode;
    fullCode = fullCode.replace(appRegex, resolveApp);
}

// Third pass: resolve __PURUST_VAR__!
const varRegex = /__PURUST_VAR__!\\(([\\s\\S]*?)\\)/g;
fullCode = fullCode.replace(varRegex, (fullMatch, fnName) => {
    fnName = fnName.trim();
    if (signatures[fnName]) {
        let expectedTypes = signatures[fnName];
        let missingCount = expectedTypes.length;
        if (missingCount === 0) return fnName + '()';
        
        let code = fnName + '(';
        let etaArgs = [];
        for (let i = 0; i < missingCount; i++) {
            let exp = expectedTypes[i];
            if (exp === 'UnknownType') {
                etaArgs.push('mut eta_' + i + ': UnknownType');
                code += 'eta_' + i + '.clone()';
            } else if (exp === 'i64') {
                etaArgs.push('mut eta_' + i + ': i64');
                code += 'eta_' + i;
            } else if (exp === 'bool') {
                etaArgs.push('mut eta_' + i + ': bool');
                code += 'eta_' + i;
            } else {
                etaArgs.push('mut eta_' + i + ': ' + exp);
                code += 'eta_' + i + '.clone()';
            }
            if (i < missingCount - 1) code += ', ';
        }
        code += ')';
        
        // Wrap in closures
        for (let i = missingCount - 1; i >= 0; i--) {
            code = 'perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |' + etaArgs[i] + '| -> UnknownType { ' + code + ' })), ..Default::default() })';
        }
        return code;
    }
    return fnName; // Fallback
});

const finalBundle = fullCode;`
);

// Let's also fix the appRegex declaration at the top level
bundleCode = bundleCode.replace(
    /const appRegex = \/__PURUST_APP__!\\(\(\.\*\?\), \\\[\(\.\*\?\)\\\]\\)\/g;/,
    "const appRegex = /__PURUST_APP__!\\(([\\s\\S]*?), \\[([\\s\\S]*?)\\]\\)/g;"
);

fs.writeFileSync('tests/runner/bundle.cjs', bundleCode);
console.log("Applied!");
