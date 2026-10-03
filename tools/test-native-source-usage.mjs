// After regenerating the native compiler Rust:
//   node tools/test-native-source-usage.mjs GENERATED_COMPILER_RUST FROZEN_TAST_OUTPUT
//
// Differential contract for the native source-usage validator. The candidate
// is the threaded form of
// purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/CoreFn/Usage.rs,
// injected at the NATIVE_FFI marker, and is compared with the generated
// PureScript `validateSourceUsageModulePS` on synthetic modules that cover every
// branch and every error order, plus the frozen TAST corpus (238 modules in the
// parent benchmark run). A stale GENERATED_COMPILER_RUST fails before cargo runs.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

const [rustArg, corpusArg] = process.argv.slice(2);
assert(rustArg && corpusArg,
  'Usage: node tools/test-native-source-usage.mjs GENERATED_COMPILER_RUST FROZEN_TAST_OUTPUT');
const rust = resolve(rustArg);
const corpus = resolve(corpusArg);

const usagePath = join(rust, 'Purs_PureScript_Backend_Optimizer_CoreFn_Usage/src/lib.rs');
assert.ok(existsSync(usagePath),
  `GENERATED_COMPILER_RUST lacks ${usagePath}; rebuild the native compiler first`);
const usageGenerated = readFileSync(usagePath, 'utf8');
for (const needle of [
  'PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModulePS',
  'PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModuleImpl',
  'Native source-usage validator',
]) {
  assert.ok(usageGenerated.includes(needle),
    `GENERATED_COMPILER_RUST is stale: Usage must contain ${JSON.stringify(needle)}`);
}
const jsonPath = join(rust, 'Purs_PureScript_Backend_Optimizer_CoreFn_Json/src/lib.rs');
assert.ok(existsSync(jsonPath), `GENERATED_COMPILER_RUST lacks ${jsonPath}`);
const jsonGenerated = readFileSync(jsonPath, 'utf8');
for (const needle of [
  'PureScript_Backend_Optimizer_CoreFn_Json_decodeModulePS',
  'PureScript_Backend_Optimizer_CoreFn_Json_decodeModuleImpl',
]) {
  assert.ok(jsonGenerated.includes(needle),
    `GENERATED_COMPILER_RUST is stale: Json must contain ${JSON.stringify(needle)}`);
}

// Frozen corpus: a directory of <Module>/corefn.json trees or the packed
// [{ name, contents }] diagnostic corpus.
function corpusEntries(source) {
  if (statSync(source).isFile()) {
    return JSON.parse(readFileSync(source, 'utf8'))
      .map(entry => ({ name: entry.name, value: JSON.parse(entry.contents) }));
  }
  const entries = [];
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(source, entry.name, 'corefn.json');
    if (!existsSync(file)) continue;
    entries.push({ name: entry.name, value: JSON.parse(readFileSync(file, 'utf8')) });
  }
  return entries;
}

const corpusModules = corpusEntries(corpus).map(entry => entry.value);
assert.ok(corpusModules.length > 0, `no corefn modules found in ${corpus}`);

const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-source-usage-'));
mkdirSync(join(directory, 'src'));
writeFileSync(join(directory, 'modules.ndjson'),
  corpusModules.map(module => JSON.stringify(module)).join('\n') + '\n');

const modules = ['purust_core', 'perceus_ptr', 'Purs_Data_Argonaut_Core', 'Purs_Data_Argonaut_Decode_Error',
  'Purs_Data_Either', 'Purs_Data_Maybe', 'Purs_PureScript_Backend_Optimizer_CoreFn',
  'Purs_PureScript_Backend_Optimizer_CoreFn_Json', 'Purs_PureScript_Backend_Optimizer_CoreFn_Usage'];
writeFileSync(join(directory, 'Cargo.toml'),
  '[package]\nname = "purust_native_source_usage_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));

const ffi = threadedRust(readFileSync(new URL(
  '../../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/CoreFn/Usage.rs',
  import.meta.url), 'utf8'));
assert.ok(ffi.includes('Native source-usage validator'),
  'Usage.rs lost the source-usage validator marker');
writeFileSync(join(directory, 'src/main.rs'), readFileSync(
  new URL('./test-native-source-usage.rs', import.meta.url), 'utf8')
  .replace(/^\s*\/\/ NATIVE_FFI$/m, () => ffi));
console.log(`Retained source usage test workspace: ${directory}; ${corpusModules.length} frozen modules`);
for (const [stage, executable, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet',
    '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_source_usage_test'),
    [join(directory, 'modules.ndjson')]],
]) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  if (result.stdout.trim()) console.log(result.stdout.trim());
}
