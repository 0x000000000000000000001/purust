const fs = require('fs');
const lines = fs.readFileSync('tests/runner/output-test/app/cargo_errors.json', 'utf8').split('\n');

const errors = new Map();

for (const line of lines) {
    if (!line.trim()) continue;
    try {
        const msg = JSON.parse(line);
        if (msg.reason === 'compiler-message' && msg.message && msg.message.code) {
            const code = msg.message.code.code;
            if (code !== 'E0425') {
                if (!errors.has(code)) {
                    errors.set(code, new Set());
                }
                errors.get(code).add(msg.message.message);
            }
        }
    } catch (e) {}
}

for (const [code, messages] of errors) {
    console.log(`--- ${code} ---`);
    let i = 0;
    for (const m of messages) {
        console.log(m.split('\n')[0]);
        if (i++ > 5) break;
    }
}
