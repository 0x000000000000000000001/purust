const fs = require('fs');

// 1. Fix bundle.cjs
let bundleCode = fs.readFileSync('bundle.cjs', 'utf8');
bundleCode = bundleCode.replace(/if \(f === 'a'\) \{\n\s*dynamicRecordA \+= \`    pub \$\{f\}: Option<i64>,\\n\`/, `if (f === 'init_int') {
        dynamicRecordA += \`    pub \${f}: Option<i64>,\\n\``);
fs.writeFileSync('bundle.cjs', bundleCode);

// 2. Fix CodeGen.purs
let pursCode = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');
// Fix mk_int preamble
pursCode = pursCode.replace(/Record_a \{ a: Some\(val\)/, 'Record_a { init_int: Some(val)');

// Fix OpIntNum
pursCode = pursCode.replace(/\.a\.unwrap\(\)/g, '.init_int.unwrap()');

fs.writeFileSync('src/Purust/CodeGen.purs', pursCode);
