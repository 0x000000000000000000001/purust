const fs = require('fs');
let fullContent = fs.readFileSync('tests/runner/bundle.cjs', 'utf8');
// wait, I need to test with the generated code
