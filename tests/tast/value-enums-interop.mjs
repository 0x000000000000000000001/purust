// Run after npm run build, selecting the TAST compiler through PURS or PATH.
// Exercise Main's real pipeline, Rust crates, generated FFI stubs and actual
// comparison FFIs, including a polymorphic call which must pass through Value.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(new URL('fixtures/value-enums/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'purust-enum-interop-'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
try {
  const output = join(directory, 'output');
  run(process.env.PURS ?? 'purs', ['compile', ...['EnumTypes', 'EnumConsumer', 'Ordering'].map(n => join(fixture, `${n}.purs`)),
    '--codegen', 'corefn', '--output', output]);
  const tast = JSON.parse(readFileSync(join(output, 'EnumTypes/corefn.json'), 'utf8'));
  assert.ok(Array.isArray(tast.dataDecls), 'Set PURS to the TAST compiler.');
  const rust = join(directory, 'rust');
  run(process.execPath, ['--stack-size=65536', join(root, 'bin/purust.js'),
    '--source', output, '--out', rust, '--main', 'EnumConsumer'], directory);
  const types = readFileSync(join(rust, 'Purs_EnumTypes/src/lib.rs'), 'utf8');
  const consumer = readFileSync(join(rust, 'Purs_EnumConsumer/src/lib.rs'), 'utf8');
  assert.match(types, /#\[derive\(Clone, Copy\)\]\npub enum Color/);
  assert.match(consumer, /Value::Class\(std::rc::Rc::new/);
  assert.match(consumer, /unwrap_class::<Purs_EnumTypes::Color>/);
  assert.doesNotMatch(consumer, /Rc<Purs_EnumTypes::Color>/);

  // Compile real generated libraries directly, without registry dependencies or
  // running the unused effect-main wrapper generated for the CLI entry module.
  const libs = new Map();
  function library(name, source) {
    const target = join(directory, `lib${name}.rlib`);
    run('rustc', ['--edition=2021', '--crate-type=rlib', '--crate-name', name, source, '-o', target,
      '-L', `dependency=${directory}`, ...[...libs].flatMap(([n, p]) => ['--extern', `${n}=${p}`])]);
    libs.set(name, target);
  }
  library('perceus_ptr', join(root, 'tests/runtime/perceus_ptr/src/lib.rs'));
  for (const name of ['purust_core', 'Purs_Data_Ordering', 'Purs_EnumTypes', 'Purs_EnumConsumer']) {
    library(name, join(rust, name, 'src/lib.rs'));
  }
  const ord = fileURLToPath(new URL('../../../purust-prelude/src/Data/Ord.rs', import.meta.url));
  const strings = fileURLToPath(new URL('../../../purust-strings/src/Data/String/Common.rs', import.meta.url));
  const harness = `#![allow(warnings)]
use purust_core::*;
use Purs_EnumTypes::{Color, Tree};
use Purs_EnumConsumer::*;
use std::rc::Rc;
#[path = ${JSON.stringify(ord)}] mod ord_ffi;
#[path = ${JSON.stringify(strings)}] mod string_ffi;
fn main() {
    fn needs_copy<T: Copy>() {}
    needs_copy::<Color>();
    let _: fn(Color) -> Color = EnumConsumer_missingColor;
    let red = Purs_EnumTypes::EnumTypes_red();
    assert!(EnumConsumer_isRed(red));
    assert!(!EnumConsumer_isRed(EnumConsumer_black()));
    for color in [Color::R, Color::B] {
        let restored = EnumConsumer_roundTrip(color);
        assert_eq!(EnumConsumer_isRed(restored), EnumConsumer_isRed(color));
        let flipped = EnumConsumer_throughFfi(color);
        assert_ne!(EnumConsumer_isRed(flipped), EnumConsumer_isRed(color));
        let boxed = Value::Class(Rc::new(color));
        let boxed_clone = EnumConsumer_passThrough(boxed.clone());
        drop(boxed);
        assert_eq!(EnumConsumer_isRed(*boxed_clone.unwrap_class::<Color>()), EnumConsumer_isRed(color));
    }
    EnumConsumer_passThrough(Value::Unit).unwrap_unit();
    let empty = Rc::new(Tree::E);
    let old = EnumConsumer_make(red, empty.clone(), 42, empty.clone());
    let newer = EnumConsumer_make(Color::B, old.clone(), 43, empty.clone());
    assert!(EnumConsumer_isRed(EnumConsumer_colorOf(old.clone())));
    assert!(!EnumConsumer_isRed(EnumConsumer_colorOf(newer.clone())));
    let Tree::T(_, left, key, right) = old.as_ref() else { panic!("not a node") };
    assert_eq!(*key, 42);
    assert!(Rc::ptr_eq(left, &empty) && Rc::ptr_eq(right, &empty));
    drop(newer);
    let survivor = EnumConsumer_colorOf(old);
    assert!(EnumConsumer_isRed(survivor));
    assert_eq!(Rc::strong_count(&empty), 1);
    use Purs_Data_Ordering::Ordering::{LT, EQ, GT};
    assert!(matches!(ord_ffi::Data_Ord_ordIntImpl(LT, EQ, GT, 1, 2), LT));
    assert!(matches!(ord_ffi::Data_Ord_ordIntImpl(LT, EQ, GT, 2, 2), EQ));
    assert!(matches!(ord_ffi::Data_Ord_ordIntImpl(LT, EQ, GT, 3, 2), GT));
    assert!(matches!(ord_ffi::Data_Ord_ordNumberImpl(LT, EQ, GT, 1.5, 1.0), GT));
    assert!(matches!(ord_ffi::Data_Ord_ordNumberImpl(LT, EQ, GT, f64::NAN, 1.0), EQ));
    assert!(matches!(ord_ffi::Data_Ord_ordCharImpl(LT, EQ, GT, 'a', 'b'), LT));
    assert!(matches!(ord_ffi::Data_Ord_ordStringImpl(LT, EQ, GT, "a".into(), "b".into()), LT));
    assert!(matches!(ord_ffi::Data_Ord_ordBooleanImpl(LT, EQ, GT, false, true), LT));
    assert!(matches!(string_ffi::Data_String_Common__localeCompare(LT, EQ, GT, "b".into(), "a".into()), GT));
    println!("Global enum layouts: cross-module construction, Value, FFI, stubs, Unit and persistence checked.");
}
`;
  const source = join(directory, 'interop.rs');
  const binary = join(directory, 'interop');
  writeFileSync(source, harness);
  run('rustc', ['--edition=2021', source, '-o', binary, '-L', `dependency=${directory}`,
    ...[...libs].flatMap(([name, path]) => ['--extern', `${name}=${path}`])]);
  process.stdout.write(run(binary, []));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
