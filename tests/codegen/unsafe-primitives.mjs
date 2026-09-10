// Native first-class FFI calls must preserve values and defer any function or
// effect returned by unsafeCoerce or by discharging a Partial dictionary.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const ffi = [
  '../../../purust-unsafe-coerce/src/Unsafe/Coerce.rs',
  '../../../purust-partial/src/Partial.rs',
  '../../../purust-partial/src/Partial/Unsafe.rs',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));
const rust = `${codegenPrelude(empty)}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
${ffi}

fn through_callback(convert: Func1<Value, Value>, value: Value) -> Value {
    convert(value)
}

fn main() {
    use std::cell::Cell;
    use std::rc::Rc;
    let convert = Func1::Static(Unsafe_Coerce_unsafeCoerce);
    assert_eq!(through_callback(convert.clone(), mk_int(42)).unwrap_int(), 42);
    assert_eq!(through_callback(convert.clone(), mk_string("unchanged")).unwrap_string(), "unchanged");
    let array = Rc::new(vec![mk_int(7), mk_int(11)]);
    let returned = through_callback(convert.clone(), Value::Array(array.clone())).unwrap_array();
    assert!(Rc::ptr_eq(&array, &returned));
    let payload: Rc<dyn std::any::Any> = Rc::new((42_i64, "same payload"));
    match through_callback(convert.clone(), Value::Class(payload.clone())) {
        Value::Class(returned) => assert!(Rc::ptr_eq(&payload, &returned)),
        _ => panic!("coercion changed the native payload"),
    }

    let executions = Rc::new(Cell::new(0));
    let captured = executions.clone();
    let function = Func1::Shared(Rc::new(move |_| {
        captured.set(captured.get() + 1);
        mk_int(42)
    }));
    let returned = through_callback(convert, Value::Func1(function.clone())).unwrap_func1();
    match (&function, &returned) {
        (Func1::Shared(original), Func1::Shared(returned)) => assert!(Rc::ptr_eq(original, returned)),
        _ => panic!("coercion replaced a captured closure"),
    }
    assert_eq!(executions.get(), 0, "coercing an effect must not run it");
    assert_eq!(returned(Value::Unit).unwrap_int(), 42);
    assert_eq!(executions.get(), 1);

    let dictionary_calls = Rc::new(Cell::new(0));
    let captured_calls = dictionary_calls.clone();
    let constrained = Value::Func1(Func1::Shared(Rc::new(move |dictionary| {
        assert!(matches!(dictionary, Value::Record_a(_)));
        captured_calls.set(captured_calls.get() + 1);
        Value::Func1(function.clone())
    })));
    let discharge = Func1::Static(Partial_Unsafe__unsafePartial);
    for expected_calls in 1..=2 {
        let before = executions.get();
        let returned = through_callback(discharge.clone(), constrained.clone());
        assert_eq!(dictionary_calls.get(), expected_calls);
        assert_eq!(executions.get(), before, "unsafePartial must only invoke the dictionary thunk");
        assert_eq!(returned.unwrap_func1()(Value::Unit).unwrap_int(), 42);
        assert_eq!(executions.get(), before + 1);
    }

    let crash: fn(String) -> Value = Partial__crashWith;
    let old_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(|| crash("partial diagnostic".to_owned()));
    std::panic::set_hook(old_hook);
    let error = match result {
        Err(error) => error,
        Ok(_) => panic!("Partial.crashWith unexpectedly returned"),
    };
    assert_eq!(error.downcast_ref::<String>().map(String::as_str), Some("partial diagnostic"));
}
`;

const directory = mkdtempSync(join(tmpdir(), 'purust-unsafe-primitives-'));
try {
  const source = join(directory, 'checks.rs');
  const binary = join(directory, 'checks');
  writeFileSync(source, rust);
  for (const [command, args] of [['rustc', ['--edition=2021', source, '-o', binary]], [binary, []]]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${command}: ${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  }
  console.log('Unsafe primitives: first-class coercion, preserved identities, deferred function results and Partial crash diagnostics passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
