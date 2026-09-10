// Run after npm run build. Measure Unit construction separately from its passage
// through generated functions; use the real Data.Unit FFI and generated runtime.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { singleton } from '../../output/Data.Set/index.js';
import { Just, Nothing } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { ADT, Any, Array as ArrayType, Func, Int, LitArray, LitRecord, Record as RecordType, Row, Unit } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, EffectBind, EffectPure, Lit, Local, PrimUndefined, Typed } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const bindings = [new Tuple('identity', new Typed(new Func([Unit.value], Unit.value),
  new Abs([param('unit', 0)], local('unit', 0))))];
for (const [name, from, to] of [['erase', Unit.value, Any.value], ['restore', Any.value, Unit.value]]) {
  bindings.push(new Tuple(name, new Typed(new Func([from], to),
    new Abs([param('value', 0)], local('value', 0)))));
}
bindings.push(new Tuple('pure', new Typed(new Func([Unit.value], Any.value),
  new Abs([param('unit', 0)], new EffectPure(local('unit', 0))))));
bindings.push(new Tuple('undefined', new Typed(Unit.value, PrimUndefined.value)));
bindings.push(new Tuple('unitLiteral', new Typed(Unit.value, new Lit(new LitRecord([])))));
bindings.push(new Tuple('emptyRecord', new Typed(new RecordType(new Row([], Nothing.value)), new Lit(new LitRecord([])))));
bindings.push(new Tuple('array', new Typed(new Func([Unit.value], new ArrayType(Unit.value)),
  new Abs([param('unit', 0)], new Lit(new LitArray([local('unit', 0), local('unit', 0)]))))));
bindings.push(new Tuple('boundEffect', new Typed(new Func([new ADT('Effect', ['Effect', 'Effect'], [Unit.value])], Any.value),
  new Abs([param('action', 0)], new EffectBind(new Just('unit'), 1,
    local('action', 0), new EffectPure(local('unit', 1)))))));
bindings.push(new Tuple('callErased', new Typed(new Func([new Func([Any.value], Any.value), Unit.value], Unit.value),
  new Abs([param('continuation', 0), param('unit', 1)],
    new App(local('continuation', 0), [local('unit', 1)])))));
bindings.push(new Tuple('eraseCall', new Typed(new Func([new Func([Unit.value], Unit.value), Unit.value], Any.value),
  new Abs([param('continuation', 0), param('unit', 1)],
    new App(local('continuation', 0), [local('unit', 1)])))));
for (const [name, resultType] of [['integer', Int.value], ['erased', Any.value]]) {
  const continuationType = new Func([Unit.value], resultType);
  bindings.push(new Tuple(name, new Typed(new Func([continuationType, Unit.value], resultType),
    new Abs([param('continuation', 0), param('unit', 1)],
      new Typed(resultType, new App(local('continuation', 0), [local('unit', 1)]))))));
}
const generated = codegenModule(emptyMap)(emptyMap)(
  { name: 'UnitValues', dataDecls: [], classDecls: [] },
)({ name: 'UnitValues', bindings: [{ recursive: false, bindings }] });
const unitFFI = readFileSync(new URL('../../../purust-prelude/src/Data/Unit.rs', import.meta.url), 'utf8');
const arrayFFI = readFileSync(new URL('../../../purust-arrays/src/Data/Array.rs', import.meta.url), 'utf8');
const additionalFFI = [
  ['assert_ffi', 'purust-assert/src/Test/Assert.rs'],
  ['strings_assert_ffi', 'purust-strings/src/Test/Assert.rs'],
  ['strings_console_ffi', 'purust-strings/src/Effect/Console.rs'],
  ['console_ffi', 'purust-console/src/Effect/Console.rs'],
].map(([name, path]) => `mod ${name} {\n${readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')}\n}`).join('\n');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(singleton('no,yes'))}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${unitFFI}
mod array_ffi {
${arrayFFI}
}
use array_ffi::Data_Array_unconsImpl;
${additionalFFI}
${generated}

use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
static ALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
static BYTES: AtomicUsize = AtomicUsize::new(0);
static DEALLOCATIONS: AtomicUsize = AtomicUsize::new(0);
static CALLS: AtomicUsize = AtomicUsize::new(0);
struct CountingAllocator;
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        BYTES.fetch_add(layout.size(), Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        DEALLOCATIONS.fetch_add(1, Ordering::Relaxed);
        System.dealloc(pointer, layout)
    }
}
#[global_allocator] static ALLOCATOR: CountingAllocator = CountingAllocator;
fn counts() -> (usize, usize, usize) {
    (ALLOCATIONS.load(Ordering::Relaxed), BYTES.load(Ordering::Relaxed),
     DEALLOCATIONS.load(Ordering::Relaxed))
}
fn delta(before: (usize, usize, usize)) -> (usize, usize, usize) {
    let after = counts();
    (after.0 - before.0, after.1 - before.1, after.2 - before.2)
}
fn main() {
    // Typed signatures and the dynamic boundary must agree on Unit's shape.
    let make: fn() = Data_Unit_unit;
    let identity: fn(()) = UnitValues_identity;
    let erase: fn(()) -> Value = UnitValues_erase;
    let restore: fn(Value) = UnitValues_restore;
    identity(make());
    assert!(matches!(erase(()), Value::Unit));
    restore(Value::Unit);
    UnitValues_undefined();
    UnitValues_unitLiteral();
    assert!(matches!(UnitValues_emptyRecord(), Value::Record_a(_)));
    let units = UnitValues_array(()).unwrap_array();
    assert_eq!(units.len(), 2);
    assert!(units.iter().all(|unit| matches!(unit, Value::Unit)));
    let action = Value::Func1(Func1::Static(|unit: Value| {
        unit.unwrap_unit();
        CALLS.fetch_add(1, Ordering::Relaxed);
        Value::Unit
    }));
    let before = CALLS.load(Ordering::Relaxed);
    let bound = UnitValues_boundEffect(action);
    assert_eq!(CALLS.load(Ordering::Relaxed), before);
    assert!(matches!(bound.unwrap_func1()(Value::Unit), Value::Unit));
    assert!(matches!(bound.unwrap_func1()(Value::Unit), Value::Unit));
    assert_eq!(CALLS.load(Ordering::Relaxed), before + 2);
    let before = CALLS.load(Ordering::Relaxed);
    UnitValues_callErased(Func1::Static(|value: Value| {
        assert!(matches!(value, Value::Unit));
        CALLS.fetch_add(1, Ordering::Relaxed);
        value
    }), ());
    assert_eq!(CALLS.load(Ordering::Relaxed), before + 1);
    let value = UnitValues_eraseCall(Func1::Static(|()| {
        CALLS.fetch_add(1, Ordering::Relaxed);
    }), ());
    assert!(matches!(value, Value::Unit));
    assert_eq!(CALLS.load(Ordering::Relaxed), before + 2, "boxing must evaluate its Unit expression once");
    let action = UnitValues_pure(());
    assert!(matches!(action.unwrap_func1()(Value::Unit), Value::Unit));

    let empty = Value::Func1(Func1::Static(|unit: Value| {
        unit.unwrap_unit();
        mk_int(42)
    }));
    let next = Value::Func1(Func1::Static(|head: Value| {
        Value::Func1(Func1::Shared(std::rc::Rc::new(move |tail: Value| {
            mk_int(head.unwrap_int() + tail.unwrap_array().len() as i64)
        })))
    }));
    let uncons = Data_Array_unconsImpl().unwrap_func1()(empty).unwrap_func1()(next);
    assert_eq!(uncons.unwrap_func1()(mk_array(vec![])).unwrap_int(), 42);
    assert_eq!(uncons.unwrap_func1()(mk_array(vec![mk_int(7), mk_int(8)])).unwrap_int(), 8);
    let assertion = assert_ffi::Test_Assert_assertImpl("unit".to_owned(), true);
    assert!(matches!(assertion.unwrap_func1()(Value::Unit), Value::Unit));
    let continuation = Func1::Static(|(): ()| mk_int(7));
    let check = assert_ffi::Test_Assert_checkThrows(continuation);
    assert!(!check.unwrap_func1()(Value::Unit).unwrap_bool(), "Native Unit callback must not cause a caught panic");

    // The strings fixture still has its separate legacy synchronous FFI.
    assert!(matches!(strings_assert_ffi::Test_Assert_assertImpl(mk_string("unit"), mk_bool(true)), Value::Unit));
    let continuation = Value::Func1(Func1::Static(|unit: Value| {
        unit.unwrap_unit();
        mk_int(7)
    }));
    assert!(!strings_assert_ffi::Test_Assert_checkThrows(continuation).unwrap_bool(), "Boxed Unit conversion must not cause a caught panic");
    assert!(matches!(console_ffi::Effect_Console_clear().unwrap_func1()(Value::Unit), Value::Unit));
    assert!(matches!(strings_console_ffi::Effect_Console_clear(), Value::Unit));
    // Different results expose accidental replacement of a continuation result
    // by Unit, while the counter exposes missing or premature calls.
    for expected in [-7, 0, 42] {
        let before = CALLS.load(Ordering::Relaxed);
        let continuation = Func1::Shared(std::rc::Rc::new(move |_| {
            CALLS.fetch_add(1, Ordering::Relaxed);
            expected
        }));
        let unit = UnitValues_identity(Data_Unit_unit());
        assert_eq!(CALLS.load(Ordering::Relaxed), before);
        assert_eq!(UnitValues_integer(continuation.clone(), unit.clone()), expected);
        assert_eq!(UnitValues_integer(continuation, unit), expected);
        assert_eq!(CALLS.load(Ordering::Relaxed), before + 2);
    }
    assert_eq!(UnitValues_erased(Func1::Static(|_| mk_int(43)), Data_Unit_unit()).unwrap_int(), 43);
    assert!(UnitValues_erased(Func1::Static(|_| mk_bool(true)), Data_Unit_unit()).unwrap_bool());
    let before = CALLS.load(Ordering::Relaxed);
    let returned = UnitValues_erased(Func1::Static(|_| {
        Value::Func1(Func1::Static(|_| {
            CALLS.fetch_add(1, Ordering::Relaxed);
            mk_int(99)
        }))
    }), Data_Unit_unit());
    assert_eq!(CALLS.load(Ordering::Relaxed), before, "a returned function is a value");
    assert_eq!(returned.unwrap_func1()(mk_int(0)).unwrap_int(), 99);
    assert_eq!(CALLS.load(Ordering::Relaxed), before + 1);

    let before = counts();
    for _ in 0..1000 {
        drop(std::hint::black_box(Data_Unit_unit()));
    }
    let construction = delta(before);

    let before = counts();
    for _ in 0..1000 {
        let value = UnitValues_erase(std::hint::black_box(Data_Unit_unit()));
        assert!(matches!(value, Value::Unit));
        UnitValues_restore(std::hint::black_box(value));
    }
    assert_eq!(delta(before), (0, 0, 0), "Unit boxing and unboxing must not allocate");

    let unit = Data_Unit_unit();
    let continuation = Func1::Static(|_| 42);
    let before = counts();
    for _ in 0..1000 {
        assert_eq!(UnitValues_integer(continuation.clone(),
            UnitValues_identity(std::hint::black_box(unit.clone()))), 42);
    }
    let passage = delta(before);
    assert_eq!(passage, (0, 0, 0), "passing an existing Unit must not allocate");
    assert_eq!(construction, (0, 0, 0), "constructing Unit must not allocate");
    println!("Unit construction x1000: allocations={}, requested_bytes={}, deallocations={}",
             construction.0, construction.1, construction.2);
    println!("Unit passage x1000: allocations={}, requested_bytes={}, deallocations={}",
             passage.0, passage.1, passage.2);
    println!("Minimal runtime: Value={} bytes, Record_a={} bytes",
             std::mem::size_of::<Value>(), std::mem::size_of::<Record_a>());
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-unit-values-'));
try {
  const source = join(directory, 'unit-values.rs');
  const binary = join(directory, 'unit-values');
  writeFileSync(source, rust);
  const build = spawnSync('rustc', ['--edition=2021', '-C', 'opt-level=1', source, '-o', binary], { encoding: 'utf8' });
  assert.equal(build.status, 0, `rustc: ${build.error ?? ''}\n${build.stdout}\n${build.stderr}`);
  const run = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.error ?? ''}\n${run.stdout}\n${run.stderr}`);
  process.stdout.write(run.stdout);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
