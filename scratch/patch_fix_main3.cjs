const fs = require('fs');
let code = fs.readFileSync('fix_main_regex.cjs', 'utf8');

// We need to remove the old Record_a definitions that came from purust run
code = code.replace(/code = lines\.join\('\\n'\);/, `
    let inRecord = false;
    let newLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#[derive(Clone)]')) {
            if (lines[i+1] && lines[i+1].startsWith('pub struct Record_a')) {
                inRecord = true;
                continue;
            }
        }
        if (inRecord) {
            if (lines[i] === '}') {
                inRecord = false;
            }
            continue;
        }
        newLines.push(lines[i]);
    }
    lines = newLines;
    code = lines.join('\\n');
`);

fs.writeFileSync('fix_main_regex.cjs', code);
