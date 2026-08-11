const fs = require('fs');
let code = fs.readFileSync('bundle.cjs', 'utf8');

const regex = /for \(const f of Array\.from\(fields\)\.sort\(\)\) \{[\s\S]*?\}\n\}\ndynamicRecordA \+= "}\\n\\n";/;
const replacement = `for (const f of Array.from(fields).sort()) {
    if (f === 'a') {
        dynamicRecordA += \`    pub \${f}: i64,\\n\`;
    } else if (f.endsWith('_bool')) {
        dynamicRecordA += \`    pub \${f}: Option<bool>,\\n\`;
    } else if (f.endsWith('_i64')) {
        dynamicRecordA += \`    pub \${f}: Option<i64>,\\n\`;
    } else if (f.endsWith('_f64')) {
        dynamicRecordA += \`    pub \${f}: Option<f64>,\\n\`;
    } else if (f.endsWith('_str')) {
        dynamicRecordA += \`    pub \${f}: Option<&'static str>,\\n\`;
    } else {
        dynamicRecordA += \`    pub \${f}: Option<UnknownType>,\\n\`;
    }
}
dynamicRecordA += "}\\n\\n";`;

if (!code.match(regex)) {
    console.error("Could not find bundle regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);
fs.writeFileSync('bundle.cjs', code);
console.log("Fixed bundle.cjs for mangled fields!");
