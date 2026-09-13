use purust_core::*;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_Foreign_Object::*;
use Purs_Foreign_Object_ST::*;
use Purs_ObjectProbe::*;

fn run(action: Value) -> Value {
    action.unwrap_func1()(Value::Unit)
}

fn boxed(object: Rc<Object>) -> Value {
    Value::Class(Rc::new(object))
}

fn handle(value: Value) -> Rc<Object> {
    value.unwrap_class::<Rc<Object>>().clone()
}

fn put(object: &Rc<Object>, key: &str, value: Value) {
    run(Foreign_Object_ST_poke(key.into(), value, object.clone()));
}

fn lookup(nothing: Value, just: Value, key: &str, object: &Rc<Object>) -> Value {
    Foreign_Object__lookup().unwrap_func1()(nothing)
        .unwrap_func1()(just)
        .unwrap_func1()(mk_string(key))
        .unwrap_func1()(boxed(object.clone()))
}

fn get(key: &str, object: &Rc<Object>) -> Value {
    lookup(Value::Unit, Value::Func1(Func1::Static(|value| value)), key, object)
}

fn just(value: &Purs_Data_Maybe::Maybe) -> Value {
    match value {
        Purs_Data_Maybe::Maybe::Just(value) => value.clone(),
        _ => panic!("Expected Just"),
    }
}

fn nothing(value: &Purs_Data_Maybe::Maybe) {
    assert!(matches!(value, Purs_Data_Maybe::Maybe::Nothing));
}

#[test]
fn generated_round_trips_primitives_arrays_and_records() {
    for value in [0, -7, 42] {
        assert_eq!(just(&ObjectProbe_roundTrip(value)).unwrap_int(), value);
        assert_eq!(just(&ObjectProbe_recordRoundTrip(value)).unwrap_int(), value);
        assert_eq!(just(&ObjectProbe_freezeSnapshot(value)).unwrap_int(), value);
        let array = just(&ObjectProbe_arrayRoundTrip(value)).unwrap_array();
        assert_eq!(array.len(), 2);
        assert_eq!(array[0].unwrap_int(), value);
        assert_eq!(array[1].unwrap_int(), 0);
        assert_eq!(just(&ObjectProbe_lookup("key".into(), ObjectProbe_runObject(value))).unwrap_int(), value);
    }
    for value in [false, true] {
        assert_eq!(just(&ObjectProbe_boolRoundTrip(value)).unwrap_bool(), value);
    }
    for value in ["", "clé😀"] {
        assert_eq!(just(&ObjectProbe_stringRoundTrip(value.into())).unwrap_string(), value);
    }
}

#[test]
fn generated_insert_and_delete_preserve_immutable_inputs() {
    let empty = ObjectProbe_empty();
    let first = ObjectProbe_insert("key".into(), 42, empty.clone());
    let second = ObjectProbe_insert("key".into(), 7, first.clone());
    let deleted = ObjectProbe_delete("key".into(), first.clone());
    nothing(&ObjectProbe_lookup("key".into(), empty));
    assert_eq!(just(&ObjectProbe_lookup("key".into(), first.clone())).unwrap_int(), 42);
    assert_eq!(just(&ObjectProbe_lookup("key".into(), second.clone())).unwrap_int(), 7);
    nothing(&ObjectProbe_lookup("key".into(), deleted.clone()));
    assert!(!Rc::ptr_eq(&first, &second));
    assert!(!Rc::ptr_eq(&first, &deleted));
}

#[test]
fn generated_thaw_and_freeze_box_the_shared_type_and_isolate_mutations() {
    let original = ObjectProbe_runObject(42);
    let thawed = handle(run(ObjectProbe_thaw(original.clone())));
    let mutable: Rc<STObject> = thawed.clone();
    put(&mutable, "key", mk_int(7));
    let frozen = handle(run(ObjectProbe_freeze(mutable.clone())));
    put(&mutable, "key", mk_int(9));
    assert!(!Rc::ptr_eq(&original, &thawed));
    assert!(!Rc::ptr_eq(&frozen, &thawed));
    assert_eq!(just(&ObjectProbe_lookup("key".into(), original)).unwrap_int(), 42);
    assert_eq!(just(&ObjectProbe_lookup("key".into(), frozen)).unwrap_int(), 7);
    assert_eq!(get("key", &mutable).unwrap_int(), 9);
}

#[test]
fn copy_reads_at_execution_and_allocates_independently_on_replay() {
    let source = Foreign_Object_empty();
    let action = Foreign_Object__copyST(boxed(source.clone()));
    put(&source, "key", mk_int(42));
    let first = handle(run(action.clone()));
    put(&source, "key", mk_int(7));
    let second = handle(run(action));
    assert!(!Rc::ptr_eq(&source, &first));
    assert!(!Rc::ptr_eq(&first, &second));
    assert_eq!(get("key", &first).unwrap_int(), 42);
    assert_eq!(get("key", &second).unwrap_int(), 7);
    put(&first, "key", mk_int(9));
    assert_eq!(get("key", &source).unwrap_int(), 7);
    assert_eq!(get("key", &second).unwrap_int(), 7);
}

#[test]
fn shallow_copies_preserve_and_release_payload_references() {
    struct Payload { count: i64 }
    let record = Rc::new(Payload { count: 42 });
    let array = Rc::new(vec![mk_int(1)]);
    let weak_record = Rc::downgrade(&record);
    let weak_array = Rc::downgrade(&array);
    let original = Foreign_Object_empty();
    put(&original, "record", Value::Class(record.clone()));
    put(&original, "array", Value::Array(array.clone()));
    let copy = handle(run(Foreign_Object__copyST(boxed(original.clone()))));
    let stored = get("record", &copy);
    assert_eq!(stored.unwrap_class::<Payload>().count, 42);
    assert!(std::ptr::eq(stored.unwrap_class::<Payload>(), record.as_ref()));
    assert!(Rc::ptr_eq(&get("array", &copy).unwrap_array(), &array));
    drop(stored); drop(record); drop(array); drop(original);
    assert!(weak_record.upgrade().is_some()); assert!(weak_array.upgrade().is_some());
    run(Foreign_Object_ST_delete("record".into(), copy.clone()));
    assert!(weak_record.upgrade().is_none());
    drop(copy);
    assert!(weak_array.upgrade().is_none());
}

#[test]
fn run_st_invokes_once_and_preserves_the_result_handle() {
    let object = Foreign_Object_empty();
    let returned = object.clone();
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let action = Value::Func1(Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        boxed(returned.clone())
    })));
    let result = Foreign_Object_runST(action);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(Rc::ptr_eq(&result, &object));
}

#[test]
fn lookup_waits_for_the_fourth_application_and_is_reusable() {
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let callback = Value::Func1(Func1::Shared(Rc::new(move |value| {
        seen.fetch_add(1, Ordering::SeqCst); value
    })));
    let partial = Foreign_Object__lookup().unwrap_func1()(mk_string("absent"))
        .unwrap_func1()(callback).unwrap_func1()(mk_string("key"));
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    let object = Foreign_Object_empty();
    assert_eq!(partial.unwrap_func1()(boxed(object.clone())).unwrap_string(), "absent");
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    put(&object, "key", mk_int(42));
    assert_eq!(partial.unwrap_func1()(boxed(object.clone())).unwrap_int(), 42);
    put(&object, "key", mk_int(7));
    assert_eq!(partial.unwrap_func1()(boxed(object)).unwrap_int(), 7);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[test]
fn lookup_distinguishes_missing_and_falsy_values() {
    let object = Foreign_Object_empty();
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let callback = Value::Func1(Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst); mk_bool(true)
    })));
    assert!(!lookup(mk_bool(false), callback.clone(), "key", &object).unwrap_bool());
    for value in [mk_int(0), mk_bool(false), mk_string(""), Value::Unit] {
        put(&object, "key", value);
        assert!(lookup(mk_bool(false), callback.clone(), "key", &object).unwrap_bool());
    }
    assert_eq!(calls.load(Ordering::SeqCst), 4);
}

#[test]
fn lookup_returns_the_selected_callback_or_default_without_reboxing() {
    let object = Foreign_Object_empty();
    let payload = Rc::new(vec![mk_int(42)]);
    let default = Rc::new(vec![mk_int(7)]);
    let callback = Value::Func1(Func1::Static(|value| value));
    let missing = lookup(Value::Array(default.clone()), callback.clone(), "key", &object);
    assert!(Rc::ptr_eq(&missing.unwrap_array(), &default));
    put(&object, "key", Value::Array(payload.clone()));
    let found = lookup(Value::Array(default), callback, "key", &object);
    assert!(Rc::ptr_eq(&found.unwrap_array(), &payload));
}

#[test]
fn lookup_callback_can_reenter_and_mutate_the_same_object() {
    let object = Foreign_Object_empty();
    put(&object, "key", mk_int(42));
    let nested = object.clone();
    let callback = Value::Func1(Func1::Shared(Rc::new(move |value| {
        run(Foreign_Object_ST_delete("key".into(), nested.clone())); value
    })));
    assert_eq!(lookup(Value::Unit, callback, "key", &object).unwrap_int(), 42);
    assert!(matches!(get("key", &object), Value::Unit));
}

#[test]
fn generated_empty_and_unicode_keys_survive_copy_and_deletion() {
    let empty = ObjectProbe_empty();
    let first = ObjectProbe_insert("".into(), 0, empty.clone());
    let second = ObjectProbe_insert("clé😀".into(), 42, first.clone());
    let third = ObjectProbe_delete("".into(), second.clone());
    nothing(&ObjectProbe_lookup("clé😀".into(), empty));
    nothing(&ObjectProbe_lookup("clé😀".into(), first));
    assert_eq!(just(&ObjectProbe_lookup("".into(), second)).unwrap_int(), 0);
    nothing(&ObjectProbe_lookup("".into(), third.clone()));
    assert_eq!(just(&ObjectProbe_lookup("clé😀".into(), third)).unwrap_int(), 42);
}
