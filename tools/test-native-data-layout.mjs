import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

assert(process.argv[2], 'Usage: node tools/test-native-data-layout.mjs GENERATED_COMPILER_RUST');
const rust = resolve(process.argv[2]);
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-data-layout-'));
mkdirSync(join(directory, 'src'));
const modules = ['purust_core', 'Purs_Data_Map_Internal', 'Purs_Data_Tuple', 'Purs_Data_Ord', 'Purs_Data_Set', 'Purs_Purust_DataLayout'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_data_layout_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
const ffi = threadedRust(readFileSync(new URL('../src/Purust/DataLayout.rs', import.meta.url), 'utf8'));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-data-layout.rs', import.meta.url), 'utf8').replace('// NATIVE_FFI', ffi));
console.log(`Retained data-layout test workspace: ${directory}`);
for (const [stage, executable, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_data_layout_test'), []],
]) {
  const run = spawnSync(executable, args, { encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), run.stdout + run.stderr);
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
}
