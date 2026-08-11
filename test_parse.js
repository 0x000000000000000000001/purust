import fs from 'fs';
import { decodeModule } from './output/PureScript.Backend.Optimizer.CoreFn.Json/index.js';

const jsonStr = fs.readFileSync('output/Main/corefn.json', 'utf8');
const json = JSON.parse(jsonStr);
const decoded = decodeModule(json);
if (decoded.constructor.name === 'Left') {
  console.log(JSON.stringify(decoded.value0, null, 2));
} else {
  console.log("Success");
}
