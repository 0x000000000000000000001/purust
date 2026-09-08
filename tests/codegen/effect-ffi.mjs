// Run after npm run build. Exercise the real Effect FFI with the generated
// runtime, including deferred construction and replay of each effect.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const effect = readFileSync(new URL('../../../purust-effect/src/Effect.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(empty)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${effect}
use std::rc::Rc;
use std::cell::{Cell, RefCell};
fn run(action: &Value) -> Value {
    action.unwrap_func1()(Value::Unit)
}
fn log_action(log: Rc<RefCell<Vec<i64>>>, n: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        log.borrow_mut().push(n);
        mk_int(n)
    })))
}
fn main() {
    // A function returned by pure is a value, never another effect to force.
    let calls = Rc::new(Cell::new(0));
    let captured_calls = calls.clone();
    let function = Value::Func1(Func1::Shared(Rc::new(move |_| {
        captured_calls.set(captured_calls.get() + 1);
        mk_int(42)
    })));
    let pure = Effect_pureE(function);
    assert_eq!(calls.get(), 0);
    let returned = run(&pure);
    assert_eq!(calls.get(), 0);
    assert_eq!(run(&returned).unwrap_int(), 42);
    assert_eq!(calls.get(), 1);
    let _ = run(&pure);
    assert_eq!(calls.get(), 1);

    let events = Rc::new(RefCell::new(Vec::new()));
    let action_events = events.clone();
    let action = Value::Func1(Func1::Shared(Rc::new(move |_| {
        action_events.borrow_mut().push("action");
        mk_int(7)
    })));
    let next_events = events.clone();
    let next = Func1::Shared(Rc::new(move |value: Value| {
        assert_eq!(value.unwrap_int(), 7);
        next_events.borrow_mut().push("next");
        let body_events = next_events.clone();
        Value::Func1(Func1::Shared(Rc::new(move |_| {
            body_events.borrow_mut().push("body");
            mk_int(42)
        })))
    }));
    let bound = Effect_bindE(action, next);
    assert!(events.borrow().is_empty());
    assert_eq!(run(&bound).unwrap_int(), 42);
    assert_eq!(run(&bound).unwrap_int(), 42);
    assert_eq!(*events.borrow(), vec!["action", "next", "body", "action", "next", "body"]);

    let log = Rc::new(RefCell::new(Vec::new()));
    let for_log = log.clone();
    let for_loop = Effect_forE(2, 5, Func1::Shared(Rc::new(move |n| log_action(for_log.clone(), n))));
    assert!(log.borrow().is_empty());
    assert!(matches!(run(&for_loop), Value::Unit));
    run(&for_loop);
    assert_eq!(*log.borrow(), vec![2, 3, 4, 2, 3, 4]);
    for (lo, hi) in [(2, 2), (5, 2)] {
        run(&Effect_forE(lo, hi, Func1::Static(|_| panic!("empty range evaluated its callback"))));
    }

    log.borrow_mut().clear();
    let foreach_log = log.clone();
    let foreach_loop = Effect_foreachE(mk_array(vec![mk_int(3), mk_int(1), mk_int(4)]),
        Func1::Shared(Rc::new(move |n: Value| log_action(foreach_log.clone(), n.unwrap_int()))));
    assert!(log.borrow().is_empty());
    assert!(matches!(run(&foreach_loop), Value::Unit));
    run(&foreach_loop);
    assert_eq!(*log.borrow(), vec![3, 1, 4, 3, 1, 4]);
    run(&Effect_foreachE(mk_array(vec![]), Func1::Static(|_| panic!("empty array evaluated its callback"))));

    let until_checks = Rc::new(Cell::new(0));
    let captured_until = until_checks.clone();
    let until = Effect_untilE(Value::Func1(Func1::Shared(Rc::new(move |_| {
        captured_until.set(captured_until.get() + 1);
        mk_bool(captured_until.get() >= 3)
    }))));
    assert_eq!(until_checks.get(), 0);
    assert!(matches!(run(&until), Value::Unit));
    assert_eq!(until_checks.get(), 3);
    run(&until);
    assert_eq!(until_checks.get(), 4);

    let iterations = Rc::new(Cell::new(0));
    let checks = Rc::new(Cell::new(0));
    let condition_iterations = iterations.clone();
    let condition_checks = checks.clone();
    let condition = Value::Func1(Func1::Shared(Rc::new(move |_| {
        condition_checks.set(condition_checks.get() + 1);
        mk_bool(condition_iterations.get() < 3)
    })));
    let body_iterations = iterations.clone();
    let body = Value::Func1(Func1::Shared(Rc::new(move |_| {
        body_iterations.set(body_iterations.get() + 1);
        mk_int(99)
    })));
    let while_loop = Effect_whileE(condition, body);
    assert_eq!(checks.get(), 0);
    assert_eq!(iterations.get(), 0);
    assert!(matches!(run(&while_loop), Value::Unit));
    assert_eq!(checks.get(), 4);
    assert_eq!(iterations.get(), 3);
    run(&while_loop);
    assert_eq!(checks.get(), 5);
    assert_eq!(iterations.get(), 3);
}
`;

const dir = mkdtempSync(join(tmpdir(), 'purust-effect-ffi-'));
try {
  const source = join(dir, 'effect-ffi.rs');
  const binary = join(dir, 'effect-ffi');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', [source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Effect FFI: pure, bind and loops preserve deferral, order and replay.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
