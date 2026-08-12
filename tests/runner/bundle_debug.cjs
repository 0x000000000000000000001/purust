const fs = require('fs');
const dirs = fs.readdirSync('output');

let fullContent = "";

for (const dir of dirs) {
    const p = 'output/' + dir + '/src/main.rs';
    if (fs.existsSync(p)) {
        fullContent += fs.readFileSync(p, 'utf8') + '\n\n';
    }
}

const unknownTypeRegex = /use perceus_ptr::PerceusPtr;\n\npub type UnknownType[\s\S]*?pub fn mk_array[\s\S]*?\}\n\n/;
const unknownMatch = fullContent.match(unknownTypeRegex);
const unknownDef = unknownMatch ? unknownMatch[0] : "";

const recordADefRegex = /#\[derive\(Clone, Default\)\]\npub struct Record_a \{[\s\S]*?\}\n\n/g;
let cleanedContent = fullContent
    .replace(recordADefRegex, '')
    .split(unknownMatch ? unknownMatch[0] : "").join('');

const fields = new Set(["tag", "vals"]);
const initRegex = /Record_a \{([\s\S]*?)\.\.Default::default\(\) \}/g;
let match;
while ((match = initRegex.exec(fullContent)) !== null) {
    const flds = match[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
    for (const f of flds) {
        const name = f.split(':')[0].trim();
        if (name && /^(r#)?[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fields.add(name);
    }
}
const accRegex = /\.((?:r#)?[a-zA-Z0-9_]+)\.clone\(\)\.unwrap\(\)/g;
while ((match = accRegex.exec(fullContent)) !== null) {
    fields.add(match[1]);
}
const updRegex = /_mut\.((?:r#)?[a-zA-Z0-9_]+) = Some\(/g;
while ((match = updRegex.exec(fullContent)) !== null) {
    fields.add(match[1]);
}
const ignore = new Set(["unwrap", "clone", "as_ref", "call", "tag", "vals"]);
for (const i of ignore) fields.delete(i);

let dynamicRecordA = "#[derive(Clone, Default)]\npub struct Record_a {\n";
dynamicRecordA += "    pub tag: &'static str,\n";
dynamicRecordA += "    pub vals: Option<std::rc::Rc<Vec<UnknownType>>>,\n";
dynamicRecordA += "    pub call: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>,\n";

for (const f of Array.from(fields).sort()) {
    if (f === 'init_int') {
        dynamicRecordA += `    pub ${f}: Option<i64>,\n`;
    } else if (f === 'init_bool') {
        dynamicRecordA += `    pub ${f}: Option<bool>,\n`;
    } else if (f === 'init_number') {
        dynamicRecordA += `    pub ${f}: Option<f64>,\n`;
    } else if (f === 'init_string') {
        dynamicRecordA += `    pub ${f}: Option<&'static str>,\n`;
    } else if (f === 'init_char') {
        dynamicRecordA += `    pub ${f}: Option<char>,\n`;
    } else if (f === 'init_array') {
        dynamicRecordA += `    pub ${f}: Option<std::rc::Rc<Vec<UnknownType>>>,\n`;
    } else {
        dynamicRecordA += `    pub ${f}: Option<UnknownType>,\n`;
    }
}
dynamicRecordA += "}\n\n";

let fullCode = "#![allow(warnings)]\n#![allow(non_snake_case)]\n#![allow(non_camel_case_types)]\n" + unknownDef + dynamicRecordA + cleanedContent;

const sigRegex = /pub fn ([a-zA-Z0-9_]+)\((.*?)\) -> (?:crate::)?UnknownType/g;
let signatures = {};
while ((match = sigRegex.exec(fullCode)) !== null) {
    const fnName = match[1];
    const argsStr = match[2].trim();
    if (argsStr.length === 0) {
        signatures[fnName] = [];
        continue;
    }
    
    // Parse arguments accounting for nested <>, ()
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

const appRegex = /__PURUST_APP__!\(([\s\S]*?), \[([\s\S]*?)\]\)/g;
const resolveApp = (fullMatch, fnName, argCode) => {
    fnName = fnName.trim();
    
    // Parse args carefully
    let parsedArgs = [];
    let currentArg = "";
    let depth = 0;
    for (let i = 0; i < argCode.length; i++) {
        let c = argCode[i];
        if (c === '[' || c === '(' || c === '{') depth++;
        if (c === ']' || c === ')' || c === '}') depth--;
        if (c === ',' && depth === 0) {
            let ac = currentArg.trim();
            if (ac.length > 0) {
                let ty = 'unk';
                if (ac.endsWith('/*i64*/')) ty = 'i64';
                if (ac.endsWith('/*bool*/')) ty = 'bool';
                parsedArgs.push({code: ac.replace(/\/\*.*?\*\//g, '').trim(), ty});
            }
            currentArg = "";
        } else {
            currentArg += c;
        }
    }
    let ac = currentArg.trim();
    if (ac.length > 0) {
        let ty = 'unk';
        if (ac.endsWith('/*i64*/')) ty = 'i64';
        if (ac.endsWith('/*bool*/')) ty = 'bool';
        parsedArgs.push({code: ac.replace(/\/\*.*?\*\//g, '').trim(), ty});
    }

    if (signatures[fnName]) {
        let expectedTypes = signatures[fnName];
        let providedArgsLength = parsedArgs.length;
        
        let finalArgs = parsedArgs.map((arg, i) => {
            let exp = expectedTypes[i];
            if (!exp) return arg.code;
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
                etaArgs.push('mut eta_' + i + ': UnknownType');
                if (exp === 'UnknownType') {
                    code += 'eta_' + i + '.clone()';
                } else if (exp === 'i64') {
                    code += 'eta_' + i + '.init_int.clone().unwrap()';
                } else if (exp === 'bool') {
                    code += 'eta_' + i + '.init_bool.clone().unwrap()';
                } else if (exp === 'String') {
                    code += 'eta_' + i + '.init_string.clone().unwrap().to_string()';
                } else if (exp === 'char') {
                    code += 'eta_' + i + '.init_char.clone().unwrap()';
                } else if (exp === 'f64') {
                    code += 'eta_' + i + '.init_number.clone().unwrap()';
                } else if (exp.startsWith('std::rc::Rc<Vec')) {
                    code += 'eta_' + i + '.init_array.clone().unwrap()';
                } else {
                    code += 'eta_' + i + '.call.clone().unwrap()';
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
    }
    
    // Fallback if not a top-level function
    let acc = fnName;
    for (let arg of parsedArgs) {
        let argCode = arg.code;
        if (arg.ty === 'i64') argCode = 'crate::mk_int(' + argCode + ')';
        if (arg.ty === 'bool') argCode = 'crate::mk_bool(' + argCode + ')';
        acc = '(' + acc + ').call.clone().unwrap()(' + argCode + ')';
    }
    return acc;
};

let lastCode = "";
while (fullCode.match(/__PURUST_APP__!/) && fullCode !== lastCode) {
    lastCode = fullCode;
    fullCode = fullCode.replace(appRegex, resolveApp);
}

// Third pass: resolve __PURUST_VAR__!
const varRegex = /__PURUST_VAR__!\(([\s\S]*?)\)/g;
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
            etaArgs.push('mut eta_' + i + ': UnknownType');
            if (exp === 'UnknownType') {
                code += 'eta_' + i + '.clone()';
            } else if (exp === 'i64') {
                code += 'eta_' + i + '.init_int.clone().unwrap()';
            } else if (exp === 'bool') {
                code += 'eta_' + i + '.init_bool.clone().unwrap()';
            } else if (exp === 'String') {
                code += 'eta_' + i + '.init_string.clone().unwrap().to_string()';
            } else if (exp === 'char') {
                code += 'eta_' + i + '.init_char.clone().unwrap()';
            } else if (exp === 'f64') {
                code += 'eta_' + i + '.init_number.clone().unwrap()';
            } else if (exp.startsWith('std::rc::Rc<Vec')) {
                code += 'eta_' + i + '.init_array.clone().unwrap()';
            } else {
                code += 'eta_' + i + '.call.clone().unwrap()';
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

fs.mkdirSync('output-test/app/src', { recursive: true });
fs.writeFileSync('output-test/app/src/main.rs', fullCode);
console.log(signatures); console.log('Bundled ' + dirs.length + ' modules into output-test/app/src/main.rs with ' + fields.size + ' dynamic fields.');
