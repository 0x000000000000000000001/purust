// Run after npm run build. Compile the actual FFI against the generated runtime
// so erased PureScript values keep the same calling convention and result shape.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const prelude = codegenPrelude(empty);
const semigroup = readFileSync(new URL('../../../purust-prelude/src/Data/Semigroup.rs', import.meta.url), 'utf8');
const functor = readFileSync(new URL('../../../purust-prelude/src/Data/Functor.rs', import.meta.url), 'utf8');
const ord = readFileSync(new URL('../../../purust-prelude/src/Data/Ord.rs', import.meta.url), 'utf8');
const partial = readFileSync(new URL('../../../purust-partial/src/Partial/Unsafe.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));

const rust = `${prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
mod Purs_Data_Ordering {
    #[derive(Clone)]
    pub enum Ordering { LT, EQ, GT }
}
${semigroup}
${functor}
${ord}
${partial}
fn array(items: &[i64]) -> Value {
    mk_array(items.iter().map(|x| mk_int(*x)).collect())
}
fn values(array: Value) -> Vec<i64> {
    array.unwrap_array().iter().map(Value::unwrap_int).collect()
}
fn main() {
    // Coercion to the generated ABI must not require an unrelated type argument.
    let append: fn(Value, Value) -> Value = Data_Semigroup_concatArray;
    let left = mk_array(vec![mk_int(1), mk_int(2)]);
    let right = mk_array(vec![mk_int(3)]);
    assert_eq!(values(append(left.clone(), right.clone())), vec![1, 2, 3]);
    assert_eq!(values(left.clone()), vec![1, 2]);
    assert_eq!(values(right.clone()), vec![3]);
    assert_eq!(values(append(mk_array(vec![]), right)), vec![3]);
    assert_eq!(values(append(left, mk_array(vec![]))), vec![1, 2]);

    let map: fn(Func1<Value, Value>, Value) -> Value = Data_Functor_arrayMap;
    let input = array(&[1, 2, 3]);
    assert_eq!(values(map(Func1::Static(|x| mk_int(x.unwrap_int() * 2)), input.clone())), vec![2, 4, 6]);
    assert_eq!(values(input), vec![1, 2, 3]);
    assert!(values(map(Func1::Static(|_| panic!("empty map must not call its function")), array(&[]))).is_empty());

    let compare: fn(Func2<Value, Value, i64>, Value, Value) -> i64 = Data_Ord_ordArrayImpl;
    let cmp = Func2::Static(|a: Value, b: Value| match a.unwrap_int().cmp(&b.unwrap_int()) {
        std::cmp::Ordering::Less => -1,
        std::cmp::Ordering::Equal => 0,
        std::cmp::Ordering::Greater => 1,
    });
    for (left, right, expected) in [
        (&[][..], &[][..], 0), (&[][..], &[1][..], -1), (&[1][..], &[][..], 1),
        (&[1, 2][..], &[1, 2][..], 0), (&[1, 2][..], &[1, 3][..], -1),
        (&[1, 3][..], &[1, 2][..], 1), (&[1][..], &[1, 2][..], -1),
    ] {
        assert_eq!(compare(cmp.clone(), array(left), array(right)), expected);
    }
    let comparisons = std::rc::Rc::new(std::cell::Cell::new(0));
    let captured_comparisons = comparisons.clone();
    let early = Func2::Shared(std::rc::Rc::new(move |_, _| {
        captured_comparisons.set(captured_comparisons.get() + 1);
        -7
    }));
    assert_eq!(compare(early, array(&[1, 2]), array(&[3, 4])), -7);
    assert_eq!(comparisons.get(), 1);

    let discharge: fn(Value) -> Value = Partial_Unsafe__unsafePartial;
    let calls = std::rc::Rc::new(std::cell::Cell::new(0));
    let captured_calls = calls.clone();
    let constrained = Value::Func1(Func1::Shared(std::rc::Rc::new(move |dictionary| {
        assert!(matches!(dictionary, Value::Record_a(_)));
        captured_calls.set(captured_calls.get() + 1);
        mk_int(42)
    })));
    assert_eq!(discharge(constrained).unwrap_int(), 42);
    assert_eq!(calls.get(), 1);
    let array = Value::Func1(Func1::Static(|_| mk_array(vec![mk_int(7)])));
    assert_eq!(values(discharge(array)), vec![7]);
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-ffi-erased-'));
try {
  const source = join(dir, 'ffi-erased.rs');
  const binary = join(dir, 'ffi-erased');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Erased FFI values: append, map, array comparison and unsafePartial Rust checks passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
