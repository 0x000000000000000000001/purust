use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};
use purust_core::{Value, Func1};
use Purs_Data_Nullable::*;
use Purs_Data_Maybe::Maybe;
use Purs_NullableProbe::*;

fn boxed(value: Rc<Nullable>) -> Value { Value::Class(Rc::new(value)) }

#[test]
fn typed_scalar_round_trips_and_instances() {
    let missing = NullableProbe_missing();
    assert_eq!(NullableProbe_decodeInt(41, missing.clone()), 41);
    assert_eq!(NullableProbe_decodeInt(41, NullableProbe_intValue(0)), 0);
    assert!(matches!(NullableProbe_roundTrip(Rc::new(Maybe::Nothing)).as_ref(), Maybe::Nothing));
    let present = NullableProbe_roundTrip(Rc::new(Maybe::Just(Value::Int(7))));
    assert!(matches!(present.as_ref(), Maybe::Just(value) if value.unwrap_int() == 7));
    assert!(!NullableProbe_eqInt(missing.clone(), NullableProbe_intValue(7)));
    assert!(NullableProbe_eqInt(NullableProbe_intValue(7), NullableProbe_intValue(7)));
    assert!(matches!(NullableProbe_compareInt(missing.clone(), NullableProbe_intValue(7)), Purs_Data_Ordering::Ordering::LT));
    assert_eq!(NullableProbe_showInt(missing), "null");
    assert_eq!(NullableProbe_showInt(NullableProbe_intValue(7)), "7");
}

#[test]
fn typed_nested_null_collapses_but_present_retains_its_type() {
    let missing = NullableProbe_missing();
    assert_eq!(NullableProbe_decodeNested(41, NullableProbe_nest(missing.clone())), 41);
    assert_eq!(NullableProbe_decodeNested(41, NullableProbe_nest(NullableProbe_intValue(7))), 7);
    let collapsed = NullableProbe_roundTripNested(Rc::new(Maybe::Just(boxed(missing))));
    assert!(matches!(collapsed.as_ref(), Maybe::Nothing));
    let present = NullableProbe_roundTripNested(Rc::new(Maybe::Just(boxed(NullableProbe_intValue(7)))));
    let Maybe::Just(inner) = present.as_ref() else { panic!("expected Just"); };
    assert_eq!(NullableProbe_decodeInt(41, inner.unwrap_class::<Rc<Nullable>>().clone()), 7);
}

#[test]
fn fn3_and_reusable_partial_application_select_only_one_branch() {
    let calls = Rc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let callback = Value::Func1(Func1::Shared(Rc::new(move |value: Value| {
        counter.fetch_add(1, AtomicOrdering::SeqCst); value
    })));
    let fallback = Value::Class(Rc::new(AtomicUsize::new(19)));
    let null_result = Data_Nullable_nullable().unwrap_func3()(boxed(Data_Nullable_null()), fallback.clone(), Value::Unit);
    assert!(std::ptr::eq(null_result.unwrap_class::<AtomicUsize>(), fallback.unwrap_class::<AtomicUsize>()));
    assert_eq!(calls.load(AtomicOrdering::SeqCst), 0);
    let stage1 = Data_Nullable_nullable().unwrap_func1()(boxed(NullableProbe_intValue(7)));
    let stage2 = stage1.unwrap_func1()(fallback.clone());
    assert_eq!(calls.load(AtomicOrdering::SeqCst), 0);
    assert_eq!(stage2.unwrap_func1()(callback.clone()).unwrap_int(), 7);
    assert_eq!(stage2.unwrap_func1()(callback.clone()).unwrap_int(), 7);
    assert_eq!(calls.load(AtomicOrdering::SeqCst), 2);
    assert_eq!(Purs_Data_Function_Uncurried::Data_Function_Uncurried_runFn3(Data_Nullable_nullable(), boxed(NullableProbe_intValue(0)), fallback, callback).unwrap_int(), 0);
}

#[test]
fn falsy_values_unit_arrays_and_unrelated_opaque_values_are_present() {
    let identity = Value::Func1(Func1::Static(|value| value));
    let unwrap = |value| Data_Nullable_nullable().unwrap_func3()(boxed(Data_Nullable_notNull(value)), Value::Int(-999), identity.clone());
    assert!(!unwrap(Value::Bool(false)).unwrap_bool());
    assert_eq!(unwrap(Value::String(String::new())).unwrap_string(), "");
    assert!(matches!(unwrap(Value::Unit), Value::Unit));
    let items = Rc::new(vec![Value::Int(7)]);
    let Value::Array(shared) = unwrap(Value::Array(items.clone())) else { panic!("array"); };
    assert!(Rc::ptr_eq(&shared, &items));
    // A Maybe::Nothing or an unrelated opaque Option::None is not Nullable::null.
    let maybe = Rc::new(Maybe::Nothing);
    let result = unwrap(Value::Class(Rc::new(maybe.clone())));
    assert!(Rc::ptr_eq(result.unwrap_class::<Rc<Maybe>>(), &maybe));
    assert!(unwrap(Value::Class(Rc::new(None::<i64>))).unwrap_class::<Option<i64>>().is_none());
}

#[test]
fn wrapped_callbacks_preserve_captures_and_repeatability() {
    let calls = Rc::new(AtomicUsize::new(0)); let count = calls.clone();
    let wrapped = NullableProbe_functionValue(Func1::Shared(Rc::new(move |x| {
        count.fetch_add(1, AtomicOrdering::SeqCst); x + 7
    })));
    assert_eq!(calls.load(AtomicOrdering::SeqCst), 0);
    assert_eq!(NullableProbe_callFunction(wrapped.clone(), 2), 9);
    assert_eq!(NullableProbe_callFunction(wrapped, 3), 10);
    assert_eq!(calls.load(AtomicOrdering::SeqCst), 2);
}

#[test]
fn wrapped_records_retain_copy_on_write() {
    let value = Value::Record_value(perceus_ptr::PerceusPtr::new(purust_core::Record_value { value: Some(Value::Int(7)) }));
    let wrapped = NullableProbe_recordValue(value);
    assert_eq!(NullableProbe_replaceRecord(wrapped.clone(), 19).get_value().unwrap_int(), 19);
    assert_eq!(NullableProbe_readRecord(wrapped), 7);
}

#[test]
fn callback_panics_propagate_without_poisoning_and_payloads_drop() {
    struct Marker(Rc<AtomicUsize>);
    impl Drop for Marker { fn drop(&mut self) { self.0.fetch_add(1, AtomicOrdering::SeqCst); } }
    let drops = Rc::new(AtomicUsize::new(0));
    let wrapped = Data_Nullable_notNull(Value::Class(Rc::new(Marker(drops.clone()))));
    let input = boxed(wrapped.clone());
    let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        Data_Nullable_nullable().unwrap_func3()(input, Value::Unit, Value::Func1(Func1::Static(|_| panic!("nullable callback"))))
    }));
    let Err(error) = panic else { panic!("callback must panic"); };
    assert_eq!(error.downcast_ref::<&str>(), Some(&"nullable callback"));
    assert_eq!(drops.load(AtomicOrdering::SeqCst), 0);
    let value = Data_Nullable_nullable().unwrap_func3()(boxed(wrapped.clone()), Value::Unit, Value::Func1(Func1::Static(|x| x)));
    assert_eq!(drops.load(AtomicOrdering::SeqCst), 0);
    drop(wrapped); assert_eq!(drops.load(AtomicOrdering::SeqCst), 0);
    drop(value); assert_eq!(drops.load(AtomicOrdering::SeqCst), 1);
}
