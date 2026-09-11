use purust_core::*;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_PipesXProbe::*;
use Purs_Pipes_Internal::*;

#[test]
fn closed_and_its_constructor_have_uninhabited_native_inputs() {
    let _: fn(Void) -> Void = Pipes_Internal_X;
    let _: fn(Void) -> Value = Pipes_Internal_closed;
    let _: fn(Void) -> i64 = PipesXProbe_closedInt;
    let _: fn(Void) -> Void = PipesXProbe_rewrap;
    fn exhaustive(value: Void) -> i64 {
        match value {}
    }
    let _: fn(Void) -> i64 = exhaustive;
}

#[test]
fn retaining_closed_does_not_execute_it_or_change_the_result() {
    assert_eq!(PipesXProbe_keepClosed(mk_int(42)).unwrap_int(), 42);
    let array = Rc::new(vec![mk_int(42)]);
    let result = PipesXProbe_keepClosed(Value::Array(array.clone())).unwrap_array();
    assert!(Rc::ptr_eq(&array, &result));
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let callback = Func1::Shared(Rc::new(move |_: Void| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(0)
    }));
    assert_eq!(PipesXProbe_select(callback, mk_int(42)).unwrap_int(), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 0);
}

#[test]
fn invalid_foreign_value_cannot_fabricate_x() {
    let error = match std::panic::catch_unwind(|| PipesXProbe_invalid(42)) {
        Ok(value) => match value {},
        Err(error) => error,
    };
    let text = error
        .downcast_ref::<&str>()
        .copied()
        .or_else(|| error.downcast_ref::<String>().map(String::as_str));
    assert_eq!(text, Some("Expected Class"));
}

#[test]
fn boxed_closed_rejects_invalid_arguments_before_entering_its_loop() {
    let function = PipesXProbe_opaqueClosed().unwrap_func1();
    let error = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| function(mk_int(42))));
    assert!(error.is_err());
}

#[test]
fn same_named_adt_and_ordinary_newtype_keep_their_representations() {
    let payload: Rc<X> = PipesXProbe_Payload(42);
    assert_eq!(PipesXProbe_readPayload(payload), 42);
    let count: i64 = PipesXProbe_Count(42);
    assert_eq!(PipesXProbe_readCount(count), 42);
}
