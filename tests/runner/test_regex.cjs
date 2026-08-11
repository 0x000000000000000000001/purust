const fs = require('fs');
const fullContent = fs.readFileSync('output-test/app/src/main.rs', 'utf8');
const fields = new Set(["tag", "vals"]);

// 1. Initializations
const initRegex = /Record_a \{([\s\S]*?)\.\.Default::default\(\) \}/g;
let match;
while ((match = initRegex.exec(fullContent)) !== null) {
    const flds = match[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
    for (const f of flds) {
        const name = f.split(':')[0].trim();
        if (name) fields.add(name);
    }
}

// 2. Accesses
const accRegex = /\.([a-zA-Z0-9_]+)\.clone\(\)\.unwrap\(\)/g;
while ((match = accRegex.exec(fullContent)) !== null) {
    fields.add(match[1]);
}

// 3. Updates
const updRegex = /_mut\.([a-zA-Z0-9_]+) = Some\(/g;
while ((match = updRegex.exec(fullContent)) !== null) {
    fields.add(match[1]);
}

// Ignore known non-record fields or Rust keywords
const ignore = new Set(["unwrap", "clone", "as_ref", "call", "tag", "vals"]);
for (const i of ignore) fields.delete(i);

console.log("Found fields:", fields.size);
// console.log(Array.from(fields).join(", "));
