use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};

fn empty_record() -> Value {
    Value::Record_a(PerceusPtr::new(Record_a::default()))
}

fn native_record() -> Value {
    Value::Record_failed_passed_pending(PerceusPtr::new(Record_failed_passed_pending {
        failed: Some(mk_int(1)),
        passed: Some(mk_int(2)),
        pending: Some(mk_int(3)),
    }))
}

#[test]
fn insert_into_empty_and_replace_native_fields_without_mutating_aliases() {
    let empty = empty_record();
    let added = Record_Unsafe_unsafeSet("passed".into(), mk_int(7), empty.clone());
    assert!(!Record_Unsafe_unsafeHas("passed".into(), empty));
    assert_eq!(added.get_passed().unwrap_int(), 7);
    assert!(matches!(&added, Value::Record_a(_)));
    let original = native_record();
    let changed = Record_Unsafe_unsafeSet("passed".into(), mk_int(9), original.clone());
    assert!(matches!(&changed, Value::Record_failed_passed_pending(_)));
    assert_eq!(original.get_passed().unwrap_int(), 2);
    assert_eq!(changed.get_passed().unwrap_int(), 9);
    assert_eq!(changed.get_failed().unwrap_int(), 1);
    assert_eq!(changed.get_pending().unwrap_int(), 3);
}

#[test]
fn extending_a_closed_shape_preserves_every_field_and_supports_native_access() {
    let original = native_record();
    let extended = Record_Unsafe_unsafeSet("label".into(), mk_string("extra"), original.clone());
    assert!(matches!(&extended, Value::DynamicRecord(_)));
    assert!(!Record_Unsafe_unsafeHas("label".into(), original));
    assert_eq!(extended.get_failed().unwrap_int(), 1);
    assert_eq!(extended.get_label().unwrap_string(), "extra");
    assert_eq!(extended.__purust_borrow_passed().unwrap_int(), 2);
    let mut updated = extended.clone();
    updated.set_passed(mk_int(42));
    assert_eq!(updated.get_passed().unwrap_int(), 42);
    assert_eq!(extended.get_passed().unwrap_int(), 2);
}

#[test]
fn runtime_only_keys_are_not_lost_or_confused_with_reserved_names() {
    let keys = [
        "runtime-only",
        "",
        "tag",
        "call",
        "vals",
        "é\0",
        "x.y",
        "x_y",
    ];
    let mut record = empty_record();
    for (n, key) in keys.iter().enumerate() {
        let original = record.clone();
        record = Record_Unsafe_unsafeSet((*key).into(), mk_int(n as i64), record);
        assert!(!Record_Unsafe_unsafeHas((*key).into(), original));
    }
    for (n, key) in keys.iter().enumerate() {
        assert_eq!(
            Record_Unsafe_unsafeGet((*key).into(), record.clone()).unwrap_int(),
            n as i64
        );
    }
    let original = record.clone();
    let changed = Record_Unsafe_unsafeSet("runtime-only".into(), mk_int(99), record);
    assert_eq!(
        Record_Unsafe_unsafeGet("runtime-only".into(), original).unwrap_int(),
        0
    );
    assert_eq!(
        Record_Unsafe_unsafeGet("runtime-only".into(), changed).unwrap_int(),
        99
    );
    // A reserved label in a native shape must survive widening too.
    let tagged = Value::Record_tag(PerceusPtr::new(Record_tag {
        tag: Some(mk_int(8)),
    }));
    let extended = Record_Unsafe_unsafeSet("new-key".into(), mk_int(9), tagged);
    assert_eq!(
        Record_Unsafe_unsafeGet("tag".into(), extended).unwrap_int(),
        8
    );
}

#[test]
fn shallow_copy_preserves_array_and_function_identity_and_releases_captures() {
    let array = Rc::new(vec![mk_int(42)]);
    let calls = Rc::new(AtomicUsize::new(0));
    let weak = Rc::downgrade(&calls);
    let seen = calls.clone();
    let function = Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(42)
    }));
    let mut record =
        Record_Unsafe_unsafeSet("label".into(), Value::Array(array.clone()), native_record());
    record = Record_Unsafe_unsafeSet("callback".into(), Value::Func1(function.clone()), record);
    let changed = Record_Unsafe_unsafeSet("passed".into(), mk_int(8), record.clone());
    let returned_array = Record_Unsafe_unsafeGet("label".into(), changed.clone()).unwrap_array();
    assert!(Rc::ptr_eq(&array, &returned_array));
    let returned_function =
        Record_Unsafe_unsafeGet("callback".into(), changed.clone()).unwrap_func1();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    match (&function, &returned_function) {
        (Func1::Shared(a), Func1::Shared(b)) => assert!(Rc::ptr_eq(a, b)),
        _ => panic!("copied function changed identity"),
    }
    assert_eq!(returned_function(Value::Unit).unwrap_int(), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    drop(calls);
    drop(function);
    drop(returned_function);
    drop(record);
    assert!(weak.upgrade().is_some());
    drop(changed);
    assert!(weak.upgrade().is_none());
}

#[test]
fn resolved_thunks_remain_persistent() {
    let memo = std::sync::OnceLock::new();
    assert!(memo.set(native_record()).is_ok());
    let thunk = Value::Thunk(PerceusPtr::new(Thunk { value: memo }));
    let updated = Record_Unsafe_unsafeSet("passed".into(), mk_int(42), thunk.clone());
    assert_eq!(thunk.get_passed().unwrap_int(), 2);
    assert_eq!(updated.get_passed().unwrap_int(), 42);
}

#[test]
fn non_records_are_rejected() {
    assert!(std::panic::catch_unwind(|| {
        Record_Unsafe_unsafeSet("field".into(), mk_int(1), mk_int(0))
    })
    .is_err());
}

#[cfg(feature = "threaded")]
#[test]
fn shared_dynamic_records_can_be_updated_independently_across_threads() {
    let original = Record_Unsafe_unsafeSet("runtime-only".into(), mk_int(0), native_record());
    let workers: Vec<_> = (1..=8)
        .map(|n| {
            let value = original.clone();
            std::thread::spawn(move || {
                let updated = Record_Unsafe_unsafeSet("runtime-only".into(), mk_int(n), value);
                Record_Unsafe_unsafeGet("runtime-only".into(), updated).unwrap_int()
            })
        })
        .collect();
    for (index, worker) in workers.into_iter().enumerate() {
        assert_eq!(worker.join().unwrap(), (index + 1) as i64);
    }
    assert_eq!(
        Record_Unsafe_unsafeGet("runtime-only".into(), original).unwrap_int(),
        0
    );
}
