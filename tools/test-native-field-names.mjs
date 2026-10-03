import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert(process.argv[2], 'Usage: node tools/test-native-field-names.mjs GENERATED_COMPILER_RUST');
const rust = resolve(process.argv[2]);
const source = readFileSync(join(rust, 'Purs_Purust_CodeGen/src/lib.rs'), 'utf8');
for (const symbol of [
  'Purust_CodeGen_fieldBaseReference',
  'Purust_CodeGen_fieldBaseImpl',
  'Purust_CodeGen_fieldBase(',
  'Purust_CodeGen_recordFieldIdentReference',
  'Purust_CodeGen_recordFieldIdentImpl',
  'Purust_CodeGen_recordFieldIdent(',
]) {
  assert(source.includes(symbol),
    `GENERATED_COMPILER_RUST is stale: missing ${symbol}; regenerate it from the updated CodeGen sources first`);
}
const directory = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-field-names-'));
mkdirSync(join(directory, 'src'));
const modules = ['purust_core', 'perceus_ptr', 'Purs_Data_Map_Internal', 'Purs_Data_Ord',
  'Purs_Purust_CodeGen'];
writeFileSync(join(directory, 'Cargo.toml'), '[package]\nname = "purust_native_field_names_test"\nversion = "0.0.0"\nedition = "2021"\n' +
  '[profile.release]\nopt-level = 3\ndebug = true\nlto = false\n[dependencies]\n' +
  modules.map(name => `${name} = { path = ${JSON.stringify(join(rust, name))} }\n`).join(''));
writeFileSync(join(directory, 'src/main.rs'), readFileSync(new URL('./test-native-field-names.rs', import.meta.url)));
console.log(`Retained field-name test workspace: ${directory}`);
for (const [stage, command, args] of [
  ['build', 'cargo', ['build', '--offline', '--release', '--quiet', '--manifest-path', join(directory, 'Cargo.toml'), '--target-dir', join(rust, 'target')]],
  ['run', join(rust, 'target/release/purust_native_field_names_test'), []],
]) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(directory, stage + '.log'), (result.stdout ?? '') + (result.stderr ?? ''));
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  console.log(result.stdout.trim());
}
