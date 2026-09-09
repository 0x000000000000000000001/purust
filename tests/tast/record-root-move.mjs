// Exercise fresh TAST -> PBO -> Rust output with overflow checks enabled.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/record-root-move/', import.meta.url));
const prelude = fileURLToPath(new URL('../../../purust-prelude/src/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-record-root-move-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const output = join(directory, 'output');
  run(process.env.PURS ?? 'purs', ['compile', join(prelude, '**/*.purs'),
    join(fixture, '*.purs'), '--codegen', 'corefn', '--output', output]);
  const tast = JSON.parse(readFileSync(join(output, 'RecordRootMove/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(tast.dataDecls), 'PURS must select the TAST fork');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', output, '--out', rust, '--main', 'RecordRootMove']);
  const generated = readFileSync(join(rust, 'Purs_RecordRootMove/src/lib.rs'), 'utf8');
  const bodies = new Map(generated.split(/^pub fn /m).slice(1).map(body =>
    [body.match(/^RecordRootMove_(\w+)\(/)?.[1], body]));
  for (const name of ['bump', 'swap', 'callback', 'capture', 'callbackPayloads', 'updateDeep']) {
    assert.match(bodies.get(name), /let _record_update_0 = /, name);
  }
  assert.match(bodies.get('bump'), /let mut _base = purs_local_0;/);
  for (const name of ['updateDeep', 'callbackNested', 'captureChild', 'callbackNestedPayloads']) {
    const body = bodies.get(name);
    assert.match(body, /let _record_child_update_0 = /, name);
    assert.equal((body.match(/let mut _record_child = /g) ?? []).length, 1, name);
    assert.match(body, /_base\.set_b\(crate::Value::Unit\);/, name);
  }
  for (const name of ['updateDeep', 'callbackDeep', 'captureLeaf', 'callbackDeepPayloads']) {
    const body = bodies.get(name);
    assert.equal((body.match(/let mut _record_child(?:_\d+)? = /g) ?? []).length, 2, name);
    assert.match(body, /_record_child\.set_d\(crate::Value::Unit\);/, name);
    assert.ok(body.indexOf('let _record_child_1_update_0 = ') < body.lastIndexOf('let mut _base = '), name);
  }
  for (const name of ['retain', 'capturedBase', 'openRow']) {
    assert.doesNotMatch(bodies.get(name), /let _record_update_/, name);
  }
  const libraries = new Map();
  function library(name, source, dependencies) {
    const path = join(directory, `lib${name}.rlib`);
    run('rustc', ['--edition=2021', '--crate-type=rlib', '--crate-name', name, source,
      '-C', 'opt-level=1', '-C', 'overflow-checks=yes', '-o', path, '-L', `dependency=${directory}`,
      ...dependencies.flatMap(n => ['--extern', `${n}=${libraries.get(n)}`])]);
    libraries.set(name, path);
  }
  library('perceus_ptr', join(root, 'tests/runtime/perceus_ptr/src/lib.rs'), []);
  const pending = new Map(readdirSync(rust).filter(n => n === 'purust_core' || n.startsWith('Purs_')).map(name => {
    const manifest = readFileSync(join(rust, name, 'Cargo.toml'), 'utf8').split('[dependencies]')[1] ?? '';
    return [name, [...manifest.matchAll(/^(\w+) = \{ path = /gm)].map(m => m[1])];
  }));
  while (pending.size) {
    const ready = [...pending].find(([, deps]) => deps.every(n => libraries.has(n)));
    assert.ok(ready, `Unresolved dependencies: ${[...pending.keys()]}`);
    const [name, deps] = ready;
    library(name, join(rust, name, 'src/lib.rs'), deps);
    pending.delete(name);
  }
  const binary = join(directory, 'checks');
  run('rustc', ['--edition=2021', '-C', 'opt-level=1', '-C', 'overflow-checks=yes', join(fixture, 'checks.rs'), '-o', binary,
    '-L', `dependency=${directory}`, ...['purust_core', 'perceus_ptr', 'Purs_RecordRootMove']
      .flatMap(n => ['--extern', `${n}=${libraries.get(n)}`])]);
  process.stdout.write(run(binary, []));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
