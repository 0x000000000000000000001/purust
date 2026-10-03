import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

const [rustArg, corpusArg] = process.argv.slice(2);
assert(rustArg && corpusArg, 'Usage: node tools/test-native-type-table.mjs GENERATED_COMPILER_RUST FROZEN_TAST_OUTPUT');
const rust = resolve(rustArg), corpus = resolve(corpusArg);
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-type-table-'));
mkdirSync(join(directory, 'src'));
const cases = [];
const add = (mode, table) => cases.push(`${mode}\t${JSON.stringify(table)}`);
const constructors = [
  'Int', 'Number', 'String', 'Char', 'Boolean', 'Unit', 'Any',
  { type: 'TypeVar', name: 'a' }, { TypeVar: 'b' },
  { type: 'TypeLevelString', value: [0xd800, 0xdc00, 0xdfff] },
  { type: 'Adt', fqn: ['X', 'é😀'], args: [0, 2, 7] },
  { type: 'TypeApp', constructor: 10, args: [0, 7] },
  { type: 'Func', args: [0, 2], ret: 7 },
  { type: 'Array', element: 11 },
  { type: 'Row', fields: [{ label: [0xd800], type: 0 }, { label: 'x', type: 13 }], tail: null },
  { type: 'Row', fields: [], tail: 14 },
  { type: 'Record', row: 15 },
  { type: 'ForAll', vars: ['a', [0xdfff]], body: 16 },
  { type: 'ConstrainedType', constraints: [{ fqn: ['Data', 'Eq'], args: [7] }], body: 17 },
];
function remap(type, n) {
  if (typeof type !== 'object') return type;
  const copy = structuredClone(type), ref = id => n - 1 - id;
  for (const field of ['constructor', 'ret', 'element', 'row', 'body', 'tail']) {
    if (typeof copy[field] === 'number') copy[field] = ref(copy[field]);
  }
  if (copy.args) copy.args = copy.args.map(ref);
  if (copy.fields) copy.fields.forEach(field => { field.type = ref(field.type); });
  if (copy.constraints) copy.constraints.forEach(constraint => { constraint.args = constraint.args.map(ref); });
  return copy;
}
add('fast', []);
add('fast', constructors);
add('fast', constructors.map(type => remap(type, constructors.length)).reverse());
add('fast', [[73, 110, 116], { type: [65, 114, 114, 97, 121], element: 0 }]);
for (const type of constructors) {
  if (typeof type === 'object') {
    for (const key of Object.keys(type)) {
      const bad = structuredClone(type); delete bad[key];
      if (key !== 'tail') add('either', [...constructors, bad]);
    }
  }
}
const invalid = [null, false, 123, '', 'Unknown', {}, { type: 'Unknown' }, { TypeVar: 7 },
  { type: 'Array', element: -1 }, { type: 'Array', element: 999999 },
  { type: 'Array', element: 0.5 }, { type: 'Array', element: 2147483648 },
  { type: 'Array', element: 0 }, { type: 'TypeLevelString', value: [65536] },
  { type: 'Row', fields: [{ label: 'x', type: 0 }], tail: false },
  { type: 'TypeApp', constructor: 0, args: false },
  { type: 'ConstrainedType', constraints: [{ fqn: ['C'], args: [0] }], body: false }];
for (const bad of invalid) add('fallback', [bad]);
add('fallback', [{ type: 'Array', element: 1 }, { type: 'Record', row: 0 }]);
for (const first of invalid) for (const second of invalid.slice(0, 8)) add('either', [first, second]);
let seed = 42;
const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let sample = 0; sample < 200; sample++) {
  const table = ['Int', 'String', { type: 'TypeVar', name: 'a' }];
  for (let i = 3; i < 30; i++) {
    const ref = next() % i;
    switch (next() % 6) {
      case 0: table.push({ type: 'Array', element: ref }); break;
      case 1: table.push({ type: 'Func', args: [0, 2], ret: ref }); break;
      case 2: table.push({ type: 'ForAll', vars: ['a'], body: ref }); break;
      case 3: table.push({ type: 'Row', fields: [{ label: 'x', type: ref }] }); break;
      case 4: table.push({ type: 'Adt', fqn: ['M', `T${i}`], args: [ref] }); break;
      default: table.push({ type: 'ConstrainedType', constraints: [{ fqn: ['C'], args: [0, 2] }], body: ref });
    }
  }
  add('fast', table);
  add('fast', table.map(type => remap(type, table.length)).reverse());
}
let corpusTables = 0;
for (const module of readdirSync(corpus, { withFileTypes: true })) {
  if (!module.isDirectory()) continue;
  const path = join(corpus, module.name, 'corefn.json');
  if (!existsSync(path)) continue;
  const value = JSON.parse(readFileSync(path, 'utf8'));
  add('either', value.typeTable); corpusTables++;
}
assert(corpusTables > 0, `No frozen module tables in ${corpus}`);
writeFileSync(join(directory, 'cases.ndjson'), cases.join('\n') + '\n');
const modules = ['purust_core', 'perceus_ptr', 'Purs_Data_Argonaut_Core', 'Purs_Data_Argonaut_Decode_Error', 'Purs_Data_Either',
  'Purs_Data_Maybe', 'Purs_Data_Tuple', 'Purs_Foreign_Object', 'Purs_PureScript_Backend_Optimizer_CoreFn',
  'Purs_PureScript_Backend_Optimizer_CoreFn_TypeTable', 'Purs_PureScript_Backend_Optimizer_CoreFn_Json',
  'Purs_Data_Map_Internal', 'Purs_Data_Ord', 'Purs_Data_Foldable'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_type_table_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
const ffi = threadedRust(readFileSync(new URL('../../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/CoreFn/Json.rs', import.meta.url), 'utf8'));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-type-table.rs', import.meta.url), 'utf8').replace(/^\s*\/\/ NATIVE_FFI$/m, () => ffi));
console.log(`Retained type-table test workspace: ${directory}; ${corpusTables} frozen module tables`);
for (const [stage, executable, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_type_table_test'), [join(directory, 'cases.ndjson')]],
]) {
  const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), run.stdout + run.stderr);
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
}
