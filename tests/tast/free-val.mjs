// freeap's opaque Val crosses unsafeCoerce as an arbitrary value. The backend
// must keep it boxed (UnknownType) instead of wrapping it in Rc<Val>.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/free-val/', import.meta.url));
const unsafeSource = fileURLToPath(new URL('../../../purust-unsafe-coerce/src/Unsafe/Coerce.purs', import.meta.url));
const recordUnsafeSource = fileURLToPath(new URL('../../../purust-prelude/src/Record/Unsafe.purs', import.meta.url));
for (const source of [unsafeSource, recordUnsafeSource]) assert.ok(existsSync(source), source);
const directory = mkdtempSync(join(tmpdir(), 'purust-free-val-'));
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: directory, encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  const tast = join(directory, 'tast');
  run(process.env.PURS ?? 'purs', ['compile', join(fixture, 'FreeValProbe.purs'),
    unsafeSource, recordUnsafeSource, '--codegen', 'corefn', '--output', tast]);
  const input = JSON.parse(readFileSync(join(tast, 'FreeValProbe/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(input.typeTable) && Array.isArray(input.dataDecls), 'Use the TAST fork.');
  for (const threaded of [false, true]) {
    const mode = threaded ? 'threaded' : 'normal';
    const rust = join(directory, mode);
    run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
      '--source', tast, '--out', rust, '--main', 'FreeValProbe', ...(threaded ? ['--threaded'] : [])]);
    const probe = readFileSync(join(rust, 'Purs_FreeValProbe/src/lib.rs'), 'utf8');
    // No opaque value may be wrapped in Rc<Val> or downcast back from it.
    assert.doesNotMatch(probe, /(?:Rc|Arc)<[^>]*\bVal\b/, 'Val must not be an Rc/Arc payload');
    assert.doesNotMatch(probe, /unwrap_class::<[^>]*\bVal\b/, 'Val must not be downcast');
    assert.match(probe, /Box\(crate::UnknownType\)/, 'constructor fields store the boxed value');
    assert.match(probe, /Ap\(crate::UnknownType, crate::UnknownType\)/, 'opaque fields stay boxed');
    const libraries = new Map();
    function library(name, source, dependencies) {
      const output = join(rust, `lib${name}.rlib`);
      run('rustc', ['--edition=2021', '-Awarnings', ...(threaded ? ['--cfg', 'feature="threaded"'] : []),
        '--crate-type=rlib', '--crate-name', name, source, '-o', output,
        '-L', `dependency=${rust}`, ...dependencies.flatMap(dep => ['--extern', `${dep}=${libraries.get(dep)}`])]);
      libraries.set(name, output);
    }
    library('perceus_ptr', join(root, 'tests/runtime/perceus_ptr/src/lib.rs'), []);
    library('purust_core', join(rust, 'purust_core/src/lib.rs'), ['perceus_ptr']);
    library('Purs_Unsafe_Coerce', join(rust, 'Purs_Unsafe_Coerce/src/lib.rs'), ['perceus_ptr', 'purust_core']);
    library('Purs_Record_Unsafe', join(rust, 'Purs_Record_Unsafe/src/lib.rs'), ['perceus_ptr', 'purust_core']);
    library('Purs_FreeValProbe', join(rust, 'Purs_FreeValProbe/src/lib.rs'),
      ['perceus_ptr', 'purust_core', 'Purs_Unsafe_Coerce', 'Purs_Record_Unsafe']);
    const binary = join(rust, 'checks');
    run('rustc', ['--edition=2021', '-C', 'opt-level=1', join(fixture, 'checks.rs'), '-o', binary,
      '-L', `dependency=${rust}`, ...['purust_core', 'perceus_ptr', 'Purs_FreeValProbe']
        .flatMap(dep => ['--extern', `${dep}=${libraries.get(dep)}`])]);
    process.stdout.write(run(binary, []));
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
