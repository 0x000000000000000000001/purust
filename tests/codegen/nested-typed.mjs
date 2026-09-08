// Run after npm run build. Nested optimizer annotations must agree with the
// Rust representation generated for the expression they surround.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { codegenModule } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Map/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Local, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const value = Any.value;
const fnType = new Func([value, value], value);
const local = (name, level) => new Local(new Just(name), level);
const param = (name, level) => new Tuple(new Just(name), level);
const nested = body => new Typed(value, new Typed(fnType, body));
const saturated = new App(local('f', 0), [local('x', 1), local('y', 2)]);

const generated = codegenModule(empty)(empty)(
  { name: 'NestedTyped', dataDecls: [], classDecls: [] },
)({
  name: 'NestedTyped',
  bindings: [{ recursive: false, bindings: [
    // The stale function annotation remains after optimizer beta reduction,
    // while the outer annotation describes the fully applied result.
    new Tuple('apply', new Typed(new Func([fnType, value, value], value),
      new Abs([param('f', 0), param('x', 1), param('y', 2)], nested(saturated)))),
    // An actual function under the same wrappers must still be boxed.
    new Tuple('retain', new Typed(new Func([fnType], value),
      new Abs([param('f', 0)], nested(local('f', 0))))),
    // Type arguments can remain after optimizer reduction; they do not change
    // the Rust representation of the reduced expression.
    new Tuple('typeArgument', new Typed(new Func([Int.value], Int.value),
      new Abs([param('x', 0)], new Typed(Int.value,
        new TypeApp(new TypeApp(local('x', 0), fnType), value))))),
    new Tuple('retainTypeApplied', new Typed(new Func([fnType], value),
      new Abs([param('f', 0)], new TypeApp(local('f', 0), Int.value)))),
  ] }],
});

const rust = `#![allow(non_snake_case, unused_mut)]
mod purust_core {
    use std::ops::Deref;
    use std::rc::Rc;
    pub enum Func2<A, B, R> {
        Static(fn(A, B) -> R),
        Shared(Rc<dyn Fn(A, B) -> R>),
    }
    impl<A, B, R> Clone for Func2<A, B, R> {
        fn clone(&self) -> Self {
            match self { Self::Static(f) => Self::Static(*f), Self::Shared(f) => Self::Shared(f.clone()) }
        }
    }
    impl<A: 'static, B: 'static, R: 'static> Deref for Func2<A, B, R> {
        type Target = dyn Fn(A, B) -> R;
        fn deref(&self) -> &Self::Target {
            match self { Self::Static(f) => f, Self::Shared(f) => f.as_ref() }
        }
    }
}
#[derive(Clone)]
pub enum Value {
    Int(i64),
    Func2(purust_core::Func2<Value, Value, Value>),
}
pub type UnknownType = Value;
pub fn mk_int(n: i64) -> Value { Value::Int(n) }
${generated}
fn add(x: Value, y: Value) -> Value {
    match (x, y) { (Value::Int(x), Value::Int(y)) => Value::Int(x + y), _ => panic!("expected integers") }
}
fn main() {
    let f = purust_core::Func2::Static(add);
    assert!(matches!(NestedTyped_apply(f.clone(), Value::Int(19), Value::Int(23)), Value::Int(42)));
    match NestedTyped_retain(f.clone()) {
        Value::Func2(retained) => assert!(matches!(retained(Value::Int(20), Value::Int(22)), Value::Int(42))),
        _ => panic!("the actual function must remain callable"),
    }
    assert_eq!(NestedTyped_typeArgument(42), 42);
    match NestedTyped_retainTypeApplied(f) {
        Value::Func2(retained) => assert!(matches!(retained(Value::Int(20), Value::Int(22)), Value::Int(42))),
        _ => panic!("type application must preserve the function representation"),
    }
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-nested-typed-'));
try {
  const source = join(dir, 'nested-typed.rs');
  const binary = join(dir, 'nested-typed');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Typed annotations and type applications: 4 generated Rust checks passed.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
