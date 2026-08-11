const fs = require('fs');
const json = JSON.parse(fs.readFileSync('output/Main/corefn.json'));
console.log(json.dataDecls[0]);
