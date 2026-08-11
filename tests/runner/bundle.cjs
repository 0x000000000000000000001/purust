const fs = require('fs');
const dirs = fs.readdirSync('output');

let fullContent = "";

for (const dir of dirs) {
    const p = 'output/' + dir + '/src/main.rs';
    if (fs.existsSync(p)) {
        fullContent += fs.readFileSync(p, 'utf8') + '\n\n';
    }
}

// Extract the header (up to the first '// Data declarations:' that includes Record_a)
const recordADefRegex = /#\[derive\(Clone, Default\)\]\npub struct Record_a \{[\s\S]*?\}\n\n/;
const recordAMatch = fullContent.match(recordADefRegex);
const recordADef = recordAMatch ? recordAMatch[0] : "";

const unknownTypeRegex = /use perceus_ptr::PerceusPtr;\n\npub type UnknownType[\s\S]*?pub fn mk_int[\s\S]*?\}\n\n/;
const unknownMatch = fullContent.match(unknownTypeRegex);
const unknownDef = unknownMatch ? unknownMatch[0] : "";

// Remove all occurrences of them
let cleanedContent = fullContent
    .split(recordADefRegex).join('')
    .split(unknownTypeRegex).join('');

const finalBundle = unknownDef + recordADef + cleanedContent;

fs.mkdirSync('output-test/app/src', { recursive: true });
fs.writeFileSync('output-test/app/src/main.rs', finalBundle);
console.log('Bundled ' + dirs.length + ' modules into output-test/app/src/main.rs');
