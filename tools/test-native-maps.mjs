import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../src/Purust/Threading.js';

const rust = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Usage: node tools/test-native-maps.mjs GENERATED_COMPILER_RUST');
const directory = mkdtempSync(join(tmpdir(), 'purust-native-maps-'));
try {
  mkdirSync(join(directory, 'src'));
  const modules = ['purust_core', 'Purs_Data_Map_Internal', 'Purs_Data_Maybe', 'Purs_Data_Ord',
    'Purs_Data_Ordering', 'Purs_PureScript_Backend_Optimizer_CoreFn', 'Purs_PureScript_Backend_Optimizer_NativeMaps'];
  writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_maps_test"\nversion = "0.0.0"\nedition = "2021"\n' +
    '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
    modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
  const ffi = threadedRust(readFileSync(new URL('../../../purescript-backend-optimizer-purust/src/PureScript/Backend/Optimizer/NativeMaps.rs', import.meta.url), 'utf8'));
  writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-maps.rs', import.meta.url), 'utf8').replace('// NATIVE_FFI', ffi));
  const build = spawnSync('cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')], { encoding: 'utf8', timeout: 300000, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(build.status, 0, build.error?.message ?? build.stderr);
  const run = spawnSync(join(rust, 'target/release/purust_native_maps_test'), [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(run.stdout.trim());
} finally { rmSync(directory, { recursive: true, force: true }); }
