const fs = require('fs');
const dirs = fs.readdirSync('output');

let fullContent = "";

for (const dir of dirs) {
    const p = 'output/' + dir + '/src/main.rs';
    if (fs.existsSync(p)) {
        fullContent += fs.readFileSync(p, 'utf8') + '\n\n';
    }
}

const unknownTypeRegex = /use perceus_ptr::PerceusPtr;\n\npub type UnknownType[\s\S]*?pub fn mk_int[\s\S]*?\}\n\n/;
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
        if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fields.add(name);
    }
}
const accRegex = /\.([a-zA-Z0-9_]+)\.clone\(\)\.unwrap\(\)/g;
while ((match = accRegex.exec(fullContent)) !== null) {
    fields.add(match[1]);
}
const updRegex = /_mut\.([a-zA-Z0-9_]+) = Some\(/g;
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
    if (f === 'a') {
        dynamicRecordA += `    pub ${f}: i64,\n`;
    } else {
        dynamicRecordA += `    pub ${f}: Option<UnknownType>,\n`;
    }
}
dynamicRecordA += "}\n\n";

const finalBundle = unknownDef + dynamicRecordA + cleanedContent;

fs.mkdirSync('output-test/app/src', { recursive: true });
fs.writeFileSync('output-test/app/src/main.rs', finalBundle);
console.log('Bundled ' + dirs.length + ' modules into output-test/app/src/main.rs with ' + fields.size + ' dynamic fields.');
