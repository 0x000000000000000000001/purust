// Fresh TAST, generated DOM/text workers and the complete ordinary decoder.
// The same Rust checks execute with specialization on/off and with Rc/Arc.
import assert from 'node:assert/strict';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { threadedRust } from '../../src/Purust/Threading.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = join(root, 'tests/tast/fixtures/json-schemas');
const base = process.env.PURUST_JSON_SCHEMAS_OUTPUT ?? join(tmpdir(), 'opencode');
mkdirSync(base, { recursive: true });
const directory = mkdtempSync(join(base, 'purust-json-schemas-'));
console.log(directory);
// b8x -c may rebuild the canonical bundle. Every mode here must use identical
// compiler bytes even when another validation rebuilds that executable.
const compiler = join(directory, 'purust.mjs');
writeFileSync(compiler, readFileSync(join(root, 'bin/purust.js')));
const dist = resolve(root, '../../purescript/.stack-work/dist');
const forks = globSync('**/build/purs/purs', { cwd: dist });
assert.ok(process.env.PURS || forks.length === 1, 'Select the TAST fork with PURS');
const purs = process.env.PURS ?? join(dist, forks[0]);
const env = { ...process.env, PATH: `${resolve(purs, '..')}:${join(root, 'node_modules/.bin')}:${process.env.PATH}`,
  GHCRTS: '-N2', CARGO_BUILD_JOBS: '2', CARGO_PROFILE_DEV_DEBUG: '0', CARGO_PROFILE_TEST_DEBUG: '0' };
function run(label, command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(directory, `${label}.log`), `${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  assert.equal(result.status, 0, `${label}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
let config = 'package:\n  name: schema-probe\n  dependencies: [argonaut-core, argonaut-codecs, arrays, effect, either, foldable-traversable, maybe, prelude, strings]\nworkspace:\n  packageSet:\n    registry: 77.10.1\n  extraPackages:\n';
for (const name of readdirSync(resolve(root, '..')).filter(n => n.startsWith('purust-'))) {
  const path = resolve(root, '..', name), yaml = join(path, 'spago.yaml');
  if (!existsSync(yaml)) continue;
  const match = readFileSync(yaml, 'utf8').match(/name:\s*"?([A-Za-z0-9_.-]+)"?\s*$/m);
  if (match) config += `    ${match[1]}:\n      path: ${JSON.stringify(path)}\n`;
}
writeFileSync(join(directory, 'spago.yaml'), config);
mkdirSync(join(directory, 'src'));
for (const extension of ['purs', 'rs', 'js'])
  writeFileSync(join(directory, `src/SchemaProbe.${extension}`), readFileSync(join(fixture, `SchemaProbe.${extension}`)));
run('purs', 'spago', ['build']);
let oracle;
for (const [mode, flags] of [['ordinary', ['--no-json-schemas']], ['boxed', ['--no-json-layouts', '--no-json-arrays']], ['records', ['--no-json-arrays']], ['native', []], ['threaded', ['--threaded']]]) {
  const rust = join(directory, mode);
  run(`generate-${mode}`, process.execPath, ['--stack-size=65536', compiler,
    '--source', join(directory, 'output'), '--out', rust, '--main', 'SchemaProbe', ...flags]);
  const generated = readFileSync(join(rust, 'Purs_SchemaProbe/src/lib.rs'), 'utf8');
  if (mode === 'ordinary') assert.doesNotMatch(generated, /fn SchemaProbe___purust_json_/);
  else {
    assert.match(generated, /fn SchemaProbe___purust_json_\d+_worker/);
    assert.match(generated, /_construct\(/, 'the actual custom method must be specialized');
    assert.match(generated, /SchemaText::parse/, 'combined must use the generated text path');
    if (mode !== 'boxed') assert.match(generated, /impl purust_core::NativeRecord/);
    if (mode === 'native' || mode === 'threaded') {
      assert.match(generated, /purust_core::NativeRecords\(out\)/);
      assert.match(generated, /purust_core::NativeClasses\(out\)/);
    }
  }
  const tests = join(rust, 'Purs_SchemaProbe/tests'); mkdirSync(tests);
  const checks = readFileSync(join(fixture, 'checks.rs'), 'utf8');
  writeFileSync(join(tests, 'schemas.rs'), mode === 'threaded' ? threadedRust(checks) : checks);
  env.SCHEMA_PROBE_OUTPUT = join(directory, `${mode}.values`);
  const output = run(`test-${mode}`, 'cargo', ['test', '--offline', '-q', '-p', 'Purs_SchemaProbe', '--test', 'schemas'], rust);
  assert.match(output, /0 failed/);
  if (mode === 'native' || mode === 'threaded') {
    const scanner = run(`scanner-${mode}`, 'cargo', ['test', '--offline', '-q', '-p', 'Purs_Data_Argonaut_Core', '--lib'], rust);
    assert.match(scanner, /1 passed; 0 failed/);
  }
  const values = readFileSync(env.SCHEMA_PROBE_OUTPUT, 'utf8');
  if (mode === 'ordinary') oracle = values;
  else assert.equal(values, oracle, `differential values, errors and consumers: ${mode}`);
}
