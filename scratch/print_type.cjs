const fs = require('fs');
const json = JSON.parse(fs.readFileSync('tests/runner/output/Data.Array.NonEmpty/corefn.json', 'utf8'));

function walk(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(walk);
  } else if (obj && typeof obj === 'object') {
    if (obj.type === 'Var' && obj.value && obj.value.identifier === 'intersectBy') {
      console.log(JSON.stringify(obj, null, 2));
    }
    for (let k in obj) {
      walk(obj[k]);
    }
  }
}
walk(json);
