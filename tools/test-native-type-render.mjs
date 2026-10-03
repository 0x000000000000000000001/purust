import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

assert(process.argv[2] && process.argv[3],
  'Usage: node tools/test-native-type-render.mjs GENERATED_COMPILER_RUST FROZEN_TAST_OUTPUT');
const rust = resolve(process.argv[2]), corpus = resolve(process.argv[3]);
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-type-render-'));
mkdirSync(join(directory, 'src'));

// Frozen corpus: a directory of <Module>/corefn.json trees or the packed
// [{ name, contents }] diagnostic corpus. Every module type table is rendered
// by both implementations. Layout facts reproduce valueEnumsForModule and
// opaqueEmptyTypesForModule so the value-enum and opaque branches are exercised.
function corpusEntries() {
  if (statSync(corpus).isFile()) {
    return JSON.parse(readFileSync(corpus, 'utf8')).map(entry => ({ name: entry.name, value: JSON.parse(entry.contents) }));
  }
  const entries = [];
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(corpus, entry.name, 'corefn.json');
    if (!existsSync(file)) continue;
    entries.push({ name: entry.name, value: JSON.parse(readFileSync(file, 'utf8')) });
  }
  return entries;
}
function moduleKey(value, fallback) {
  const segments = Array.isArray(value.moduleName) ? value.moduleName : [fallback];
  return segments.join('.').replaceAll('.', '_');
}
const corpusLines = [];
const layoutKeys = new Set();
let corpusModules = 0, corpusTypes = 0;
for (const entry of corpusEntries()) {
  const module = moduleKey(entry.value, entry.name);
  const table = entry.value.typeTable;
  if (Array.isArray(table) && table.length > 0) {
    corpusLines.push(`${module}\t${JSON.stringify(table)}`);
    corpusTypes += table.length;
  }
  for (const decl of entry.value.dataDecls ?? []) {
    const name = decl.name ?? decl.typeName;
    if (typeof name !== 'string') continue;
    const constructors = decl.constructors ?? [];
    if (constructors.length > 0 && constructors.every(ctor => (ctor.fields ?? []).length === 0)) {
      layoutKeys.add(`${module}\t${name}`);
    }
    if (constructors.length === 0) {
      layoutKeys.add(`${module}\t$opaque$${name}`);
    }
  }
  corpusModules++;
}
assert(corpusModules > 0, `no corefn modules found in ${corpus}`);
assert(corpusTypes > 0, `no frozen type tables found in ${corpus}`);
writeFileSync(join(directory, 'corpus.ndjson'), corpusLines.join('\n') + '\n');
writeFileSync(join(directory, 'layouts.ndjson'), [...layoutKeys].join('\n') + '\n');

const modules = ['purust_core', 'perceus_ptr', 'Purs_Data_Argonaut_Core', 'Purs_Data_Argonaut_Decode_Error',
  'Purs_Data_Either', 'Purs_Data_Map_Internal', 'Purs_Data_Maybe', 'Purs_Data_Ord', 'Purs_Data_Set',
  'Purs_Data_Tuple', 'Purs_Foreign_Object', 'Purs_PureScript_Backend_Optimizer_CoreFn',
  'Purs_PureScript_Backend_Optimizer_CoreFn_TypeTable', 'Purs_Purust_CodeGen'];
const generated = readFileSync(join(rust, 'Purs_Purust_CodeGen/src/lib.rs'), 'utf8');
assert(generated.includes('Purust_CodeGen_codegenExprTypeWithValueEnumsPure'),
  'GENERATED_COMPILER_RUST is stale: regenerate it from the updated CodeGen.purs first');
assert(generated.includes('Purust_CodeGen_codegenExprTypeWithValueEnumsImpl'),
  'GENERATED_COMPILER_RUST is stale: regenerate it so CodeGen.rs is embedded first');
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_type_render_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
const ffi = threadedRust(readFileSync(new URL('../src/Purust/CodeGen.rs', import.meta.url), 'utf8'));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-type-render.rs', import.meta.url), 'utf8').replace(/^\/\/ NATIVE_FFI$/m, () => ffi));
console.log(`Retained type-render test workspace: ${directory}; ${corpusModules} corpus modules / ${corpusTypes} types / ${layoutKeys.size} layout keys`);
for (const [stage, executable, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_type_render_test'), [join(directory, 'corpus.ndjson'), join(directory, 'layouts.ndjson')]],
]) {
  const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), run.stdout + run.stderr);
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
}
