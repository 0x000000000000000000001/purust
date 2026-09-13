use purust_core::*;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_Foreign_Object_ST::*;
use Purs_StashProbe::*;

fn run(action: Value) -> Value {
    action.unwrap_func1()(Value::Unit)
}

fn handle(value: Value) -> Rc<STObject> {
    value.unwrap_class::<Rc<STObject>>().clone()
}

fn fresh() -> Rc<STObject> {
    handle(run(Foreign_Object_ST_new()))
}

fn peek(key: &str, object: Rc<STObject>) -> Value {
    run(Foreign_Object_ST_peekImpl(
        Func1::Static(|value| value), Value::Unit, key.into(), object,
    ))
}

fn just_int(value: &Purs_Data_Maybe::Maybe) -> i64 {
    match value {
        Purs_Data_Maybe::Maybe::Just(value) => value.unwrap_int(),
        _ => panic!("Expected Just"),
    }
}

#[test]
fn generated_purescript_round_trips_primitives_and_records() {
    for value in [0, -7, 42] {
        assert_eq!(just_int(&StashProbe_roundTrip(value)), value);
        assert_eq!(just_int(&StashProbe_recordRoundTrip(value)), value);
    }
}

#[test]
fn generated_wrappers_preserve_handle_boxing_and_peek_constructors() {
    let object = handle(run(StashProbe_allocate()));
    let action = StashProbe_putValue(42, object.clone());
    assert!(matches!(peek("key", object.clone()), Value::Unit));
    assert!(Rc::ptr_eq(&object, &handle(run(action))));
    let found = run(StashProbe_readValue(object.clone()));
    assert_eq!(just_int(found.unwrap_class::<Rc<Purs_Data_Maybe::Maybe>>()), 42);
    assert!(Rc::ptr_eq(&object, &handle(run(StashProbe_removeKey(object.clone())))));
    let missing = run(StashProbe_readValue(object));
    assert!(matches!(missing.unwrap_class::<Rc<Purs_Data_Maybe::Maybe>>().as_ref(), Purs_Data_Maybe::Maybe::Nothing));
}

#[test]
fn new_is_replayable_and_allocates_independent_objects() {
    let action = Foreign_Object_ST_new();
    let first = handle(run(action.clone()));
    let second = handle(run(action));
    assert!(!Rc::ptr_eq(&first, &second));
    run(Foreign_Object_ST_poke("key".into(), mk_int(1), first));
    assert!(matches!(peek("key", second), Value::Unit));
}

#[test]
fn poke_is_deferred_replayable_and_preserves_identity() {
    let object = fresh();
    let action = Foreign_Object_ST_poke("key".into(), mk_int(42), object.clone());
    assert!(matches!(peek("key", object.clone()), Value::Unit));
    for _ in 0..2 {
        assert!(Rc::ptr_eq(&object, &handle(run(action.clone()))));
        assert_eq!(peek("key", object.clone()).unwrap_int(), 42);
    }
}

#[test]
fn peek_is_deferred_and_only_invokes_the_selected_callback() {
    let object = fresh();
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let action = Foreign_Object_ST_peekImpl(Func1::Shared(Rc::new(move |value| {
        seen.fetch_add(1, Ordering::SeqCst); value
    })), mk_string("missing"), "key".into(), object.clone());
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(run(action.clone()).unwrap_string(), "missing");
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    run(Foreign_Object_ST_poke("key".into(), mk_bool(false), object));
    assert!(!run(action.clone()).unwrap_bool());
    assert!(!run(action).unwrap_bool());
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[test]
fn delete_is_deferred_replayable_and_preserves_identity() {
    let object = fresh();
    run(Foreign_Object_ST_poke("key".into(), mk_int(42), object.clone()));
    let action = Foreign_Object_ST_delete("key".into(), object.clone());
    assert_eq!(peek("key", object.clone()).unwrap_int(), 42);
    for _ in 0..2 {
        assert!(Rc::ptr_eq(&object, &handle(run(action.clone()))));
        assert!(matches!(peek("key", object.clone()), Value::Unit));
    }
}

#[test]
fn overwrite_preserves_other_keys_and_falsy_values() {
    let object = fresh();
    run(Foreign_Object_ST_poke("a".into(), mk_int(0), object.clone()));
    run(Foreign_Object_ST_poke("b".into(), mk_string(""), object.clone()));
    run(Foreign_Object_ST_poke("a".into(), mk_bool(false), object.clone()));
    assert!(!peek("a", object.clone()).unwrap_bool());
    assert_eq!(peek("b", object.clone()).unwrap_string(), "");
    assert!(matches!(peek("absent", object), Value::Unit));
}

#[test]
fn payload_references_are_preserved_and_released() {
    struct Payload { count: i64 }
    let record = Rc::new(Payload { count: 42 });
    let weak_record = Rc::downgrade(&record);
    let array = Rc::new(vec![mk_int(1), mk_int(2)]);
    let weak_array = Rc::downgrade(&array);
    let object = fresh();
    run(Foreign_Object_ST_poke("record".into(), Value::Class(record.clone()), object.clone()));
    run(Foreign_Object_ST_poke("array".into(), Value::Array(array.clone()), object.clone()));
    let stored = peek("record", object.clone());
    assert_eq!(stored.unwrap_class::<Payload>().count, 42);
    if let Value::Class(payload) = stored {
        assert!(std::ptr::eq(payload.as_ref().downcast_ref::<Payload>().unwrap(), record.as_ref()));
    } else { panic!("Record payload was replaced"); }
    assert!(Rc::ptr_eq(&peek("array", object.clone()).unwrap_array(), &array));
    drop(record); drop(array);
    assert!(weak_record.upgrade().is_some()); assert!(weak_array.upgrade().is_some());
    run(Foreign_Object_ST_delete("record".into(), object.clone()));
    assert!(weak_record.upgrade().is_none());
    drop(object);
    assert!(weak_array.upgrade().is_none());
}

#[test]
fn inherited_names_are_not_entries_but_can_be_written() {
    let object = fresh();
    for key in ["toString", "constructor", "hasOwnProperty", "clé😀", ""] {
        assert!(matches!(peek(key, object.clone()), Value::Unit));
        run(Foreign_Object_ST_poke(key.into(), mk_int(42), object.clone()));
        assert_eq!(peek(key, object.clone()).unwrap_int(), 42);
        run(Foreign_Object_ST_delete(key.into(), object.clone()));
        assert!(matches!(peek(key, object.clone()), Value::Unit));
    }
}

#[test]
fn peek_callback_can_reenter_without_holding_the_object_lock() {
    let object = fresh();
    run(Foreign_Object_ST_poke("key".into(), mk_int(42), object.clone()));
    let nested = object.clone();
    let action = Foreign_Object_ST_peekImpl(Func1::Shared(Rc::new(move |value| {
        run(Foreign_Object_ST_delete("key".into(), nested.clone())); value
    })), Value::Unit, "key".into(), object.clone());
    assert_eq!(run(action).unwrap_int(), 42);
    assert!(matches!(peek("key", object), Value::Unit));
}
