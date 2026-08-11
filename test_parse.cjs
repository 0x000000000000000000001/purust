const fs = require('fs');
const jsonStr = fs.readFileSync('output/Main/corefn.json', 'utf8');
const { parseJson } = require('./output/Data.Argonaut.Parser/index.js');
const { decodeModule } = require('./output/PureScript.Backend.Optimizer.CoreFn.Json/index.js');
const parsed = parseJson(jsonStr);
if (parsed.constructor.name === 'Right') {
  const decoded = decodeModule(parsed.value0);
  if (decoded.constructor.name === 'Left') {
    console.log(JSON.stringify(decoded.value0, null, 2));
  }
}
