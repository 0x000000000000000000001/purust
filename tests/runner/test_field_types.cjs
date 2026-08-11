const fs = require('fs');
const fullContent = fs.readFileSync('output-test/app/src/main.rs', 'utf8');

const fieldTypes = {};

const initRegex = /Record_a \{([\s\S]*?)\.\.Default::default\(\) \}/g;
let match;
while ((match = initRegex.exec(fullContent)) !== null) {
    const flds = match[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
    for (const f of flds) {
        const parts = f.split(':');
        const name = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            if (val === 'Some(true)' || val === 'Some(false)') {
                fieldTypes[name] = fieldTypes[name] || new Set();
                fieldTypes[name].add('bool');
            } else if (val.match(/^Some\(-?\d+\)$/)) {
                fieldTypes[name] = fieldTypes[name] || new Set();
                fieldTypes[name].add('i64');
            } else {
                fieldTypes[name] = fieldTypes[name] || new Set();
                fieldTypes[name].add('UnknownType');
            }
        }
    }
}

for (const [name, types] of Object.entries(fieldTypes)) {
    if (types.size > 1) {
        console.log(`Field ${name} has multiple types: ${Array.from(types).join(', ')}`);
    }
}
