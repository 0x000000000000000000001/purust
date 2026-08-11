import { printJsonDecodeError } from '../purescript-backend-optimizer/output/Data.Argonaut.Decode.Error/index.js';
import { getField } from '../purescript-backend-optimizer/output/Data.Argonaut.Decode.Combinators/index.js';
import { decodeArray } from '../purescript-backend-optimizer/output/Data.Argonaut.Decode.Decoders/index.js';

console.log(printJsonDecodeError(
  {
    constructor: { name: 'AtKey' },
    value0: 'dataDecls',
    value1: {
      constructor: { name: 'AtIndex' },
      value0: 0,
      value1: {
        constructor: { name: 'AtKey' },
        value0: 'typeName',
        value1: { constructor: { name: 'MissingValue' } }
      }
    }
  }
));
