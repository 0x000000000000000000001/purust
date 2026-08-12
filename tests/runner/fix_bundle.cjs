const fs = require('fs');
let code = fs.readFileSync('bundle.cjs', 'utf8');

const target = `for (const f of Array.from(fields).sort()) {
    if (f === 'a') {
        dynamicRecordA += \`    pub \${f}: i64,\\n\`;
    } else {
        dynamicRecordA += \`    pub \${f}: Option<UnknownType>,\\n\`;
    }
}`;

const replacement = `for (const f of Array.from(fields).sort()) {
    if (f === 'a') {
        dynamicRecordA += \`    pub \${f}: Option<i64>,\\n\`;
    } else if (f === 'init_bool') {
        dynamicRecordA += \`    pub \${f}: Option<bool>,\\n\`;
    } else if (f === 'init_number') {
        dynamicRecordA += \`    pub \${f}: Option<f64>,\\n\`;
    } else if (f === 'init_string') {
        dynamicRecordA += \`    pub \${f}: Option<&'static str>,\\n\`;
    } else if (f === 'init_char') {
        dynamicRecordA += \`    pub \${f}: Option<char>,\\n\`;
    } else if (f === 'init_array') {
        dynamicRecordA += \`    pub \${f}: Option<std::rc::Rc<Vec<UnknownType>>>,\\n\`;
    } else {
        dynamicRecordA += \`    pub \${f}: Option<UnknownType>,\\n\`;
    }
}`;

if (code.includes(target)) {
  fs.writeFileSync('bundle.cjs', code.replace(target, replacement));
  console.log("Patched bundle.cjs");
} else {
  console.log("Could not find target in bundle.cjs");
}
