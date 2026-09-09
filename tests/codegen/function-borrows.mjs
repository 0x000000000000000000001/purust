// Exercise representation boundaries and evaluation order on emitted Rust.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenModule, codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty as emptyMap } from '../../output/Data.Map/index.js';
import { empty as emptySet } from '../../output/Data.Set/index.js';
import { Just } from '../../output/Data.Maybe/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';
import { Any, Func, Int, LitInt } from '../../output/PureScript.Backend.Optimizer.CoreFn/index.js';
import { Abs, App, Lit, Local, Typed, TypeApp } from '../../output/PureScript.Backend.Optimizer.Syntax/index.js';

const unary = new Func([Int.value], Int.value);
const local = (name, level) => new Local(new Just(name), level);
const int = n => new Lit(new LitInt(n));
const app = (f, ...args) => new App(f, args);
const bindings = [];
function binding(name, params, body) {
  bindings.push(new Tuple(name, new Typed(new Func(params.map(p => p[1]), Int.value),
    new Abs(params.map(([name], i) => new Tuple(new Just(name), i)), body))));
}
for (const name of ['direct', 'wrapped']) {
  const f = local('f', 0);
  const callee = name === 'wrapped'
    ? new Typed(unary, new TypeApp(new Typed(Any.value, new Typed(unary, f)), Int.value)) : f;
  binding(name, [['f', unary], ['use', new Func([Int.value, unary], Int.value)]],
    app(local('use', 1), app(callee, int(7)), f));
}
binding('converted', [['f', Any.value]], app(new Typed(unary, local('f', 0)), int(7)));
binding('fromCall', [['factory', new Func([Int.value], unary)], ['argument', unary]],
  app(app(local('factory', 0), int(1)), app(local('argument', 1), int(2))));
binding('argumentPanic', [['f', unary], ['g', unary]], app(local('f', 0), app(local('g', 1), int(7))));
const generated = codegenModule(emptyMap)(emptyMap)({ name: 'FunctionBorrows', classDecls: [], dataDecls: [] })
  ({ name: 'FunctionBorrows', bindings: [{ recursive: false, bindings }] });
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(emptySet)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}] mod perceus_ptr;
${generated}
fn main() {
    use std::rc::{Rc, Weak};
    use std::cell::{Cell, RefCell};
    type Unary = dyn Fn(i64) -> i64;
    for call in [FunctionBorrows_direct, FunctionBorrows_wrapped] {
        let slot = Rc::new(RefCell::new(None::<Weak<Unary>>));
        let observer = slot.clone();
        let f: Rc<Unary> = Rc::new(move |k| {
            assert_eq!(observer.borrow().as_ref().unwrap().strong_count(), 1);
            k + 10
        });
        let weak = Rc::downgrade(&f);
        *slot.borrow_mut() = Some(weak.clone());
        assert_eq!(call(Func1::Shared(f), Func2::Static(|n, f| n + f(8))), 35);
        assert!(weak.upgrade().is_none());
    }
    assert_eq!(FunctionBorrows_converted(Value::Func1(Func1::Static(|n| mk_int(n.unwrap_int() + 20)))), 27);

    let order = Rc::new(Cell::new(0));
    let in_factory = order.clone();
    let in_argument = order.clone();
    let result = FunctionBorrows_fromCall(
        Func1::Shared(Rc::new(move |k| {
            in_factory.set(in_factory.get() * 10 + k);
            Func1::Static(|n| n + 10)
        })),
        Func1::Shared(Rc::new(move |k| {
            in_argument.set(in_argument.get() * 10 + k);
            k
        })));
    assert_eq!(result, 12);
    assert_eq!(order.get(), 12, "Evaluate the callee once, before the argument");

    let f: Rc<Unary> = Rc::new(|_| panic!("Callee must not run after argument failure"));
    let wf = Rc::downgrade(&f);
    let observer = wf.clone();
    let g: Rc<Unary> = Rc::new(move |_| {
        assert_eq!(observer.strong_count(), 1, "The callee stays alive while evaluating arguments");
        panic!("argument failure")
    });
    let wg = Rc::downgrade(&g);
    let hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        FunctionBorrows_argumentPanic(Func1::Shared(f), Func1::Shared(g))));
    std::panic::set_hook(hook);
    assert_eq!(result.unwrap_err().downcast_ref::<&str>(), Some(&"argument failure"));
    assert!(wf.upgrade().is_none() && wg.upgrade().is_none());
    println!("Borrowed calls: native and TypeApp wrappers, conversions, computed callees, argument order and unwind releases checked.");
}
`;
const directory = mkdtempSync(join(tmpdir(), 'purust-function-borrows-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    if (command === binary) process.stdout.write(result.stdout);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
