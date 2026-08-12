const fs = require('fs');
const file = fs.readFileSync('tests/runner/output/Control.Lazy/corefn.json', 'utf8');
const json = JSON.parse(file);
const fix = json.decls.find(d => d.identifier === 'fix' || (d.binds && d.binds.some(b => b.identifier === 'fix')));
console.log(JSON.stringify(fix, null, 2).substring(0, 5000));
