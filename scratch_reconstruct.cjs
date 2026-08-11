const fs = require('fs');
const lines = fs.readFileSync('/Users/0x1/.gemini/antigravity-ide/brain/01d680f9-2647-429e-86bf-4b2c7aad13a0/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
let bundleCode = "";
for (let line of lines) {
    if (!line) continue;
    const obj = JSON.parse(line);
    // Find the initial write or state of bundle.cjs if it was created, otherwise just grab the first replace and we'll apply them sequentially... wait, I can just grab the exact content from the `TargetContent` and `ReplacementContent` if I apply them.
    // Better: let's just find the last time `node bundle.cjs` was run successfully or the `replace_file_content` output.
    if (obj.tool_calls) {
        for (let tc of obj.tool_calls) {
             if (tc.name === 'write_to_file' && tc.args.TargetFile && tc.args.TargetFile.includes('bundle.cjs')) {
                 bundleCode = tc.args.CodeContent;
             }
             if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && tc.args.TargetFile && tc.args.TargetFile.includes('bundle.cjs')) {
                  // We can't easily apply patches without a full diff algorithm, but we can look for the output of `view_file` or something!
             }
        }
    }
}
console.log(bundleCode.length > 0 ? "Found bundleCode!" : "Not found from write_to_file.");
