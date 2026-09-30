import assert from 'node:assert/strict';
import { specializeDecoderSchemas } from '../../output/Purust.DecoderSchemas/index.js';
import { sanitizeIdent } from '../../output/Purust.CodeGen/index.js';
import { empty, insert } from '../../output/Data.Map/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import * as T from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import * as S from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const owner = 'AnotherDecoder';
const global = (module, name) => new S.Var(new T.Qualified(new Just(module), name));
const standard = name => global('Data.Argonaut.Decode.Class', name);
const call = (fn, ...args) => new S.App(fn, args);
const marker = 'Data_Argonaut_Decode_Internal_Record_schemaDecoderABI3';
const arities = insert(ordString)(marker)(T.Int.value)(empty);
const label = name => new S.Lit(new T.LitRecord([new T.Prop('reflectSymbol',
  new S.Abs([new Tuple(Nothing.value, 0)], new S.Lit(new T.LitString(name))))]));
const row = (native = 'nativeFieldInt') => call(standard('gDecodeJsonCons'),
  call(standard('decodeFieldId'), standard('decodeJsonInt')), standard(native),
  standard('gDecodeJsonNil'), label('quantity'), S.PrimUndefined.value, S.PrimUndefined.value);
const dictionary = native => call(standard('decodeRecord'), row(native), S.PrimUndefined.value);
function compile(expr, signatures = arities, extra = []) {
  const mod = { name: owner, bindings: [{ recursive: false, bindings: [...extra, new Tuple('read', expr)] }] };
  const before = JSON.stringify(mod);
  const result = specializeDecoderSchemas(true)(true)(_ => 'unused')(sanitizeIdent)(signatures)({ name: owner, dataDecls: [] })(mod);
  assert.equal(JSON.stringify(mod), before, 'recognition must not mutate source IR');
  return result;
}
const expression = call(standard('decodeJson'), dictionary());
assert.match(compile(expression).code, /SchemaInput/);
assert.match(compile(expression).code, /"quantity"/);
assert.equal(compile(expression, empty).code, '', 'old ports cannot receive new workers');
assert.equal(compile(expression, insert(ordString)('Data_Argonaut_Decode_Internal_Record_schemaDecoderABI2')(T.Int.value)(empty)).code,
  '', 'ABI2 ports lack borrowed discriminator predicates');
assert.equal(compile(call(standard('decodeJson'), dictionary('nativeFieldNumber'))).code, '',
  'NativeField is a real second dictionary, not disposable type metadata');
const requiredMaybe = call(standard('gDecodeJsonCons'),
  call(standard('decodeFieldId'), call(standard('decodeJsonMaybe'), standard('decodeJsonInt'))),
  call(standard('nativeFieldMaybe'), standard('nativeFieldInt')),
  standard('gDecodeJsonNil'), label('requiredMaybe'), S.PrimUndefined.value, S.PrimUndefined.value);
assert.equal(compile(call(standard('decodeJson'), call(standard('decodeRecord'), requiredMaybe, S.PrimUndefined.value))).code, '',
  'the result type Maybe does not prove that a missing field is accepted');
const shadow = new S.Lit(new T.LitRecord([new T.Prop('decodeJson',
  new S.Abs([new Tuple(Nothing.value, 0)], new S.Local(Nothing.value, 17)))]));
assert.equal(compile(call(standard('decodeJson'), call(standard('decodeArray'), shadow))).code, '',
  'a custom decoder with a captured local has no closed schema proof');
const reserved = insert(ordString)(`${owner}___purust_json_0_worker`)(T.Int.value)(arities);
assert.match(compile(expression, reserved).code, /AnotherDecoder___purust_json_1_worker/,
  'generated helper families must avoid foreign names too');
const renamed = compile(call(standard('decodeJson'), global(owner, 'alias')), arities,
  [new Tuple('alias', dictionary())]);
assert.match(renamed.code, /SchemaInput/, 'local nonrecursive aliases retain dictionary provenance');
