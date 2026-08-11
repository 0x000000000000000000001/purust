const fs = require('fs');
const lines = fs.readFileSync('/Users/0x1/.gemini/antigravity-ide/brain/01d680f9-2647-429e-86bf-4b2c7aad13a0/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
for (let line of lines) {
    if (!line) continue;
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
        for (let tc of obj.tool_calls) {
            if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
                if (tc.args.TargetFile && tc.args.TargetFile.includes('bundle.cjs')) {
                    console.log("FOUND PATCH:");
                    console.log(tc.args.ReplacementContent || JSON.stringify(tc.args.ReplacementChunks));
                }
            }
        }
    }
}
