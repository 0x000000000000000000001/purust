import fs from 'fs';
const data = JSON.parse(fs.readFileSync('tests/runner/output/Control.Bind/corefn.json', 'utf8'));
const ifM = data.decls.find(d => d.binds && d.binds.some(b => b.identifier === 'ifM'));
console.log(JSON.stringify(ifM, null, 2));
