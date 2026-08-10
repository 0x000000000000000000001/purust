const fs = require('fs');
const corefn = JSON.parse(fs.readFileSync('tests/runner/output/Data.Array.NonEmpty/corefn.json', 'utf8'));
const decls = corefn.decls;

function findIntersectByPrime(nodes) {
  for (const node of nodes) {
    if (node.bindType === 'NonRec') {
      if (node.identifier === 'intersectBy\'') {
        console.log(JSON.stringify(node.expression, null, 2));
        return;
      }
    } else {
      for (const b of node.binds) {
        if (b.identifier === 'intersectBy\'') {
          console.log(JSON.stringify(b.expression, null, 2));
          return;
        }
      }
    }
  }
}
findIntersectByPrime(decls);
