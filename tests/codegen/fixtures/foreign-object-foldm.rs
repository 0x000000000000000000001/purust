use object::Foreign_Object__foldM as fold_m;
use std::rc::Rc;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Mutex,
};

fn native(entries: Vec<(&str, Value)>) -> Rc<Object> {
    Rc::new(Object::from_entries(
        entries.into_iter().map(|(k, v)| (k.into(), v)).collect(),
    ))
}
fn immediate() -> Func2<Value, Func1<Value, Value>, Value> {
    Func2::Static(|value, next| next(value))
}
fn effect(value: Value) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| value.clone())))
}
fn deferred() -> Func2<Value, Func1<Value, Value>, Value> {
    Func2::Static(|action, next| {
        Value::Func1(Func1::Shared(Rc::new(move |_| {
            next(action.unwrap_func1()(Value::Unit)).unwrap_func1()(Value::Unit)
        })))
    })
}
fn hex(value: &str) -> String {
    purust_string_to_utf16(value)
        .iter()
        .map(|u| format!("{u:04x}"))
        .collect()
}
fn describe(value: &Value) -> String {
    match value.resolve() {
        Value::Unit => "undefined".into(),
        Value::Null => "null".into(),
        Value::Bool(v) => v.to_string(),
        Value::Int(v) => v.to_string(),
        Value::String(v) => format!("s:{}", hex(v)),
        _ => panic!("unsupported differential payload"),
    }
}
fn collect(accumulator: Value, key: String, value: Value) -> Value {
    Value::String(format!(
        "{}{}={};",
        accumulator.unwrap_string(),
        hex(&key),
        describe(&value)
    ))
}

#[test]
fn empty_fold_retains_initial_identity_without_bind_or_callback() {
    let handle = Rc::new(Object::empty());
    let initial = Value::Class(Rc::new(handle.clone()));
    let result = fold_m(
        Func2::Static(|_, _| panic!("empty bind")),
        Func3::Static(|_, _, _| panic!("empty callback")),
        initial,
        native(vec![]),
    );
    assert!(Rc::ptr_eq(&handle, result.unwrap_class::<Rc<Object>>()));
}

#[test]
fn eager_bind_observes_replacements_skips_deletions_and_ignores_additions() {
    let object = native(vec![("a", mk_int(1)), ("b", mk_int(2)), ("c", mk_int(3))]);
    let changing = object.clone();
    let result = fold_m(
        immediate(),
        Func3::Shared(Rc::new(move |z, k, v| {
            if k == "a" {
                changing.insert("b".into(), mk_int(20));
                changing.remove("c");
                changing.insert("d".into(), mk_int(4));
            }
            collect(z, k, v)
        })),
        mk_string("seed;"),
        object,
    );
    assert_eq!(result.unwrap_string(), EXPECTED_EAGER);
}

#[test]
fn deferred_bind_reads_on_continuation_execution_and_replays() {
    let object = native(vec![("a", mk_int(1)), ("b", mk_int(2)), ("c", mk_int(3))]);
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let action = fold_m(
        deferred(),
        Func3::Shared(Rc::new(move |z, k, v| {
            seen.fetch_add(1, Ordering::SeqCst);
            effect(collect(z, k, v))
        })),
        effect(mk_string("seed;")),
        object.clone(),
    );
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    object.insert("b".into(), mk_int(20));
    object.remove("c");
    object.insert("d".into(), mk_int(4));
    assert_eq!(
        action.unwrap_func1()(Value::Unit).unwrap_string(),
        EXPECTED_DEFERRED_FIRST
    );
    object.insert("a".into(), mk_int(10));
    object.insert("c".into(), mk_int(30));
    assert_eq!(
        action.unwrap_func1()(Value::Unit).unwrap_string(),
        EXPECTED_DEFERRED_SECOND
    );
    assert_eq!(calls.load(Ordering::SeqCst), 6);
}

#[test]
fn one_continuation_can_run_multiple_times_with_current_values() {
    let object = native(vec![("a", mk_int(1))]);
    let changing = object.clone();
    let result = fold_m(
        Func2::Shared(Rc::new(move |z, next| {
            let first = next(z.clone());
            changing.insert("a".into(), mk_int(2));
            mk_array(vec![first, next(z)])
        })),
        Func3::Static(collect),
        mk_string("seed;"),
        object,
    )
    .unwrap_array();
    assert_eq!(
        result.iter().map(Value::unwrap_string).collect::<Vec<_>>(),
        EXPECTED_REPEATED
    );
}

#[test]
fn bind_may_short_circuit_without_forcing_callback() {
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let original = Rc::new(vec![mk_int(42)]);
    let result = fold_m(
        Func2::Shared(Rc::new(move |z, _| {
            seen.fetch_add(1, Ordering::SeqCst);
            z
        })),
        Func3::Static(|_, _, _| panic!("short-circuited callback")),
        Value::Array(original.clone()),
        native(vec![("a", Value::Null), ("b", Value::Unit)]),
    );
    assert!(Rc::ptr_eq(&original, &result.unwrap_array()));
    assert_eq!(calls.load(Ordering::SeqCst), EXPECTED_SHORT_CIRCUIT_BINDS);
}

#[test]
fn foreign_object_payload_identity_is_not_cloned_into_a_new_object() {
    let payload = Rc::new(Object::empty());
    let expected = payload.clone();
    let result = fold_m(
        immediate(),
        Func3::Shared(Rc::new(move |_, key, value| {
            assert_eq!(key, "payload");
            assert!(Rc::ptr_eq(&expected, value.unwrap_class::<Rc<Object>>()));
            value
        })),
        Value::Unit,
        native(vec![("payload", Value::Class(Rc::new(payload.clone())))]),
    );
    assert!(Rc::ptr_eq(&payload, result.unwrap_class::<Rc<Object>>()));
}

#[test]
fn continuation_owns_record_until_dropped_without_leaking() {
    let object = native(vec![("a", mk_int(1))]);
    let weak = Rc::downgrade(&object);
    let continuation = fold_m(
        Func2::Static(|_, next| Value::Func1(next)),
        Func3::Static(collect),
        mk_string("seed;"),
        object.clone(),
    );
    drop(object);
    assert!(weak.upgrade().is_some());
    assert_eq!(
        continuation.unwrap_func1()(mk_string("seed;")).unwrap_string(),
        "seed;0061=1;"
    );
    drop(continuation);
    assert!(weak.upgrade().is_none());
}

#[test]
fn original_effect_exception_is_propagated_and_stops_execution() {
    use exception::*;
    for lazy in [false, true] {
        let error = Effect_Exception_errorWithName("fold callback".into(), "TypeError".into());
        let raised = error.clone();
        let calls = Rc::new(AtomicUsize::new(0));
        let seen = calls.clone();
        let result = purust_exception_try(|| {
            let callback = Func3::Shared(Rc::new(move |_, _, _| {
                seen.fetch_add(1, Ordering::SeqCst);
                purust_exception_raise(raised.clone())
            }));
            let result = fold_m(
                if lazy { deferred() } else { immediate() },
                callback,
                if lazy {
                    effect(Value::Unit)
                } else {
                    Value::Unit
                },
                native(vec![("a", mk_int(1)), ("b", mk_int(2))]),
            );
            if lazy {
                result.unwrap_func1()(Value::Unit)
            } else {
                result
            }
        });
        let caught = match result {
            Err(error) => error,
            Ok(_) => panic!("swallowed callback error"),
        };
        assert!(std::sync::Arc::ptr_eq(
            &purust_exception_unbox(&error),
            &purust_exception_unbox(&caught)
        ));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }
}

#[test]
fn original_bind_exception_is_not_replaced() {
    use exception::*;
    let error = Effect_Exception_error("bind failure".into());
    let raised = error.clone();
    let result = purust_exception_try(|| {
        fold_m(
            Func2::Shared(Rc::new(move |_, _| purust_exception_raise(raised.clone()))),
            Func3::Static(|_, _, _| panic!("callback after failed bind")),
            Value::Unit,
            native(vec![("a", mk_int(1))]),
        )
    });
    let caught = match result {
        Err(error) => error,
        Ok(_) => panic!("swallowed bind error"),
    };
    assert!(std::sync::Arc::ptr_eq(
        &purust_exception_unbox(&error),
        &purust_exception_unbox(&caught)
    ));
}

#[cfg(feature = "threaded")]
#[test]
fn arc_continuation_can_be_replayed_across_threads() {
    let action = fold_m(
        deferred(),
        Func3::Static(|z, k, v| effect(collect(z, k, v))),
        effect(mk_string("seed;")),
        native(vec![("a", mk_int(1)), ("b", mk_int(2))]),
    );
    let workers = (0..8)
        .map(|_| {
            let action = action.clone();
            std::thread::spawn(move || {
                for _ in 0..64 {
                    assert_eq!(
                        action.unwrap_func1()(Value::Unit).unwrap_string(),
                        "seed;0061=1;0062=2;"
                    );
                }
            })
        })
        .collect::<Vec<_>>();
    for worker in workers {
        worker.join().unwrap();
    }
}
