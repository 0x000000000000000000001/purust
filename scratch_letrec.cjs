const fs = require('fs');
const corefn = JSON.parse(fs.readFileSync('tests/runner/output/Control.Lazy/corefn.json', 'utf8'));
const fix = corefn.decls.find(d => d.identifier === 'fix');
console.dir(fix.expression, { depth: null });
