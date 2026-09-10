// Full TAST -> cached PBO implementations -> Rust pipeline, with real Prelude.
// PURS must select the TAST fork, as for the other tests in this directory.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as Type from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { substitute } from '../../output/PureScript.Backend.Optimizer.TypeSubstitution/index.js';
import { singleton } from '../../output/Data.Map/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';

// Use PBO's shared capture-avoiding substitution, including for open row types.
const substituteType = name => replacement => substitute(singleton(name)(replacement));
const a = new Type.TypeVar('a');
const b = new Type.TypeVar('b');
const r = new Type.TypeVar('r');
const row = new Type.Row([new Tuple('z', new Type.Array(a)), new Tuple('a', b)], new Just(r));
assert.deepEqual(substituteType('a')(Type.Int.value)(new Type.Record(row)), new Type.Record(
  new Type.Row([new Tuple('z', new Type.Array(Type.Int.value)), new Tuple('a', b)], new Just(r))));
const shadow = new Type.ForAll(['a'], new Type.Func([a], a));
assert.deepEqual(substituteType('a')(Type.Int.value)(shadow), shadow);
assert.deepEqual(substituteType('a')(Type.Number.value)(new Type.ForAll(['b'], new Type.Func([a, b], a))),
  new Type.ForAll(['b'], new Type.Func([Type.Number.value, b], Type.Number.value)));

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(new URL('fixtures/type-instantiation/', import.meta.url));
const prelude = fileURLToPath(new URL('../../../purust-prelude/src/', import.meta.url));
const partial = fileURLToPath(new URL('../../../purust-partial/src/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-type-instantiation-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: directory, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const output = join(directory, 'output');
  run(process.env.PURS ?? 'purs', ['compile', join(prelude, '**/*.purs'), join(partial, '**/*.purs'),
    ...['Array', 'AnnotationScope', 'PolyLoop', 'PolyConsumer'].map(name => join(fixtures, `${name}.purs`)),
    '--codegen', 'corefn', '--output', output]);
  const json = JSON.parse(readFileSync(join(output, 'PolyLoop/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(json.classDecls), 'PURS must be the TAST fork.');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', output, '--out', rust, '--main', 'PolyConsumer']);
  const consumer = readFileSync(join(rust, 'Purs_PolyConsumer/src/lib.rs'), 'utf8');
  function functionBody(name) {
    const start = consumer.indexOf(`pub fn PolyConsumer_${name}(`);
    assert.ok(start >= 0, name);
    const next = consumer.indexOf('\npub fn ', start + 1);
    return consumer.slice(start, next < 0 ? undefined : next);
  }
  for (const [name, type] of [['intLoop', 'i64'], ['intPartial', 'i64'], ['numberLoop', 'f64'], ['mixed', 'i64']]) {
    const body = functionBody(name);
    assert.match(body, new RegExp(`fn \\w+_impl\\([^\\n]*mut \\w+: ${type}\\) -> ${type}`), name);
    assert.doesNotMatch(body, /let _tco_temp_\d+ =[^\n]*(?:mk_int|mk_number|unwrap_int|unwrap_number)/, name);
  }
  assert.match(functionBody('generic'), /fn \w+_impl\([^\n]*crate::UnknownType\) -> crate::UnknownType/);
  assert.doesNotMatch(functionBody('arrayLength'), /Data_Array_length/);

  // Build fresh crates from this run; no runner rlibs or pre-existing .purmeta.
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
    const deps = [...manifest.matchAll(/^(\w+) = \{ path = /gm)].map(m => m[1]);
    return [name, deps];
  }));
  while (pending.size) {
    const ready = [...pending].find(([, deps]) => deps.every(n => libraries.has(n)));
    assert.ok(ready, `Unresolved dependencies: ${[...pending.keys()]}`);
    const [name, deps] = ready;
    library(name, join(rust, name, 'src/lib.rs'), deps);
    pending.delete(name);
  }
  const source = join(directory, 'checks.rs');
  writeFileSync(source, `#![allow(warnings)]
use purust_core::*;
use Purs_PolyLoop::*;
use Purs_PolyConsumer::*;
use Purs_AnnotationScope::*;
fn main() {
    // The payload's Int must not capture the callee's unrelated generic result.
    match PolyConsumer_scopedWrapper(41).as_ref() {
        Wrapped::Wrapped(value) => assert_eq!(value.unwrap_int(), 42),
    }
    assert_eq!(PolyLoop_partialComposed(PolyLoop_Present(mk_int(42))), 42);
    for n in [0_i64, 1, 2, 7, 1000] {
        for initial in [-42_i64, 0, 17] {
            let number = initial as f64 + 0.25;
            assert_eq!(PolyConsumer_intLoop(n, initial), initial + n);
            assert_eq!(PolyConsumer_intPartial(n, initial), initial + n);
            assert_eq!(PolyConsumer_reusePartial(n, initial), 2 * (initial + n) + 1);
            assert_eq!(PolyConsumer_mixed(n, initial), initial + 2 * n);
            assert_eq!(PolyConsumer_numberLoop(n, number), number + 0.5 * n as f64);
            // Interleave instantiations of the same cached definition.
            assert_eq!(PolyConsumer_intLoop(n, initial), initial + n);
            assert_eq!(PolyLoop_polyLoop(PolyLoop_intMonoidish(), n, mk_int(initial)).unwrap_int(), initial + n);
            assert_eq!(PolyLoop_polyLoop(PolyLoop_numberMonoidish(), n, mk_number(number)).unwrap_number(), number + 0.5 * n as f64);
            assert_eq!(PolyConsumer_generic(PolyLoop_intMonoidish(), n, mk_int(initial)).unwrap_int(), initial + n);
            assert_eq!(PolyConsumer_generic(PolyLoop_numberMonoidish(), n, mk_number(number)).unwrap_number(), number + 0.5 * n as f64);
        }
    }
    // Alternating native instantiations must not mutate the cached definition.
    let int_first = PolyConsumer_intPartial(2, 10);
    let number_middle = PolyConsumer_numberLoop(2, 10.25);
    assert_eq!((int_first, number_middle, PolyConsumer_intPartial(2, 10)), (12, 11.25, 12));
    assert_eq!(PolyConsumer_arrayLength(mk_array(vec![])), 0);
    assert_eq!(PolyConsumer_arrayLength(mk_array(vec![mk_int(1), mk_int(2)])), 2);
    println!("TAST instantiation: native Int/Number loops, two quantifiers, partial application, generic dictionaries and lexical result types checked across modules.");
}
`);
  const binary = join(directory, 'checks');
  run('rustc', ['--edition=2021', '-C', 'opt-level=1', source, '-o', binary,
    '-L', `dependency=${directory}`, ...['purust_core', 'Purs_PolyLoop', 'Purs_PolyConsumer', 'Purs_AnnotationScope']
      .flatMap(n => ['--extern', `${n}=${libraries.get(n)}`])]);
  process.stdout.write(run(binary, []));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
