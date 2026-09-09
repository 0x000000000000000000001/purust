// Exercise fresh TAST -> PBO -> Rust output with overflow checks enabled.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/function-fusion/', import.meta.url));
const prelude = fileURLToPath(new URL('../../../purust-prelude/src/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-function-fusion-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const output = join(directory, 'output');
  run(process.env.PURS ?? 'purs', ['compile', join(prelude, '**/*.purs'),
    join(fixture, '*.purs'), '--codegen', 'corefn', '--output', output]);
  const tast = JSON.parse(readFileSync(join(output, 'FunctionFusion/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(tast.dataDecls), 'PURS must select the TAST fork');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', output, '--out', rust, '--main', 'IteratorConsumer']);
  const generated = readFileSync(join(rust, 'Purs_FunctionFusion/src/lib.rs'), 'utf8');
  const bodies = new Map(generated.split(/^pub fn /m).slice(1).map(body =>
    [body.match(/^FunctionFusion_(\w+)\(/)?.[1], body]));
  const fused = bodies.get('repeat');
  assert.match(fused, /if \w+ >= 0/);
  assert.match(fused, /while _function_count > 0/);
  assert.match(fused, /else \{\s*fn FunctionFusion_repeat\(/,
    'Negative counts retain the original recursive producer');
  for (const name of ['byTwo', 'nonIdentity', 'withCounter']) {
    assert.ok(bodies.has(name), name);
    assert.doesNotMatch(bodies.get(name), /_function_count/, name);
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
    '-L', `dependency=${directory}`, ...['purust_core', 'Purs_FunctionFusion', 'Purs_IteratorConsumer']
      .flatMap(n => ['--extern', `${n}=${libraries.get(n)}`])]);
  process.stdout.write(run(binary, []));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
