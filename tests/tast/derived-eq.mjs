// Derived Eq of recursive types must generate bounded Rust code: forcing the
// instance methods of `Term`, `QueryTerm` and `RepeatSpec` inside
// `Eq (BehaviourF r)` produced a 3 MB function whose nested constructor paths
// made rustc spend minutes on one crate. A method now stays a runtime call
// once its body grows past the dictionary inlining budget, so the size of an
// instance is linear in the number of its own constructors.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/derived-eq/', import.meta.url));
const prelude = fileURLToPath(new URL('../../../purust-prelude/src/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-derived-eq-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const output = join(directory, 'output');
  run(process.env.PURS ?? 'purs', ['compile', join(prelude, '**/*.purs'),
    join(fixture, '*.purs'), '--codegen', 'corefn', '--output', output]);
  const tast = JSON.parse(readFileSync(join(output, 'DerivedEqProbe/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(tast.dataDecls), 'PURS must select the TAST fork.');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', output, '--out', rust, '--main', 'DerivedEqProbe']);
  const generated = readFileSync(join(rust, 'Purs_DerivedEqProbe/src/lib.rs'), 'utf8');
  const bodies = new Map(generated.split(/^pub fn /m).slice(1).map(body =>
    [body.match(/^DerivedEqProbe_(\w+)\(/)?.[1], body]));

  // The broken output was 3.9 MB for this module alone, with 3.86 MB in
  // `eqBehaviourF` and about a thousand references to each nested instance.
  // These bounds catch a regression to unrolling while leaving headroom for
  // debug comments and routine code generation changes.
  assert.ok(generated.length < 300000, `Derived Eq crate must stay bounded: ${generated.length} bytes`);
  const behaviourF = bodies.get('eqBehaviourF');
  assert.ok(behaviourF, 'eqBehaviourF is generated');
  assert.ok(behaviourF.length < 100000, `eqBehaviourF must stay linear: ${behaviourF.length} bytes`);
  const nestedInstanceRefs = behaviourF.match(/DerivedEqProbe_eqTerm/g)?.length ?? 0;
  assert.ok(nestedInstanceRefs < 50, `eqBehaviourF must call Eq Term instead of unrolling it: ${nestedInstanceRefs} references`);

  const libraries = new Map();
  function library(name, source, dependencies) {
    const path = join(directory, `lib${name}.rlib`);
    run('rustc', ['--edition=2021', '--crate-type=rlib', '--crate-name', name, source,
      '-C', 'opt-level=1', '-o', path, '-L', `dependency=${directory}`,
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
  run('rustc', ['--edition=2021', '-C', 'opt-level=1', join(fixture, 'checks.rs'), '-o', binary,
    '-L', `dependency=${directory}`, ...['purust_core', 'perceus_ptr', 'Purs_DerivedEqProbe', 'Purs_DerivedEqConsumer']
      .flatMap(n => ['--extern', `${n}=${libraries.get(n)}`])]);
  process.stdout.write(run(binary, []));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
