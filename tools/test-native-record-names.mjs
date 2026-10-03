import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert(process.argv[2], 'test-native-record-names.mjs GENERATED_COMPILER_RUST');
const rust = resolve(process.argv[2]);
assert(readFileSync(join(rust, 'Purs_Purust_CodeGen/src/lib.rs'), 'utf8').includes('Purust_CodeGen_recordStructNameImpl'));
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-record-names-'));
mkdirSync(join(directory, 'src'));
const modules = ['purust_core', 'Purs_Data_Map_Internal', 'Purs_Data_Ord', 'Purs_Purust_CodeGen'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_record_names_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-record-names.rs', import.meta.url)));
console.log(`Retained record-names test workspace: ${directory}`);
for (const [stage, command, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_record_names_test'), []],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  console.log(result.stdout.trim());
}
