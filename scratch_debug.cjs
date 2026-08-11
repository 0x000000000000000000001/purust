const fs = require('fs');
let fullCode = fs.readFileSync('tests/runner/output-test/app/src/main.rs', 'utf8');
const sigRegex = /pub fn ([a-zA-Z0-9_]+)\((.*?)\) -> UnknownType/g;
let match;
while ((match = sigRegex.exec(fullCode)) !== null) {
    const fnName = match[1];
    const args = match[2].split(',').map(s => s.trim()).filter(s => s.length > 0);
    args.forEach(a => {
        if (!a.includes(':')) {
            console.log("FAILED ON:", fnName, match[2], "arg:", a);
        }
    });
}
