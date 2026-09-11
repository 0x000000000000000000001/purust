use purust_core::*;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_Control_Monad_Rec_Class::Step;
use Purs_FreeMonadRecProbe::*;

#[test]
fn loop_and_done_through_pure_and_suspended_free() {
    for limit in [0, 1, 25, 1000] {
        assert_eq!(FreeMonadRecProbe_count(limit), limit);
        assert_eq!(FreeMonadRecProbe_suspended(limit), limit);
    }
}

#[test]
fn done_preserves_payloads_and_shared_free_is_replayable() {
    let array = Rc::new(vec![mk_int(42)]);
    let computation = FreeMonadRecProbe_payload(Value::Array(array.clone()));
    for _ in 0..2 {
        let returned = FreeMonadRecProbe_run(computation.clone()).unwrap_array();
        assert!(Rc::ptr_eq(&array, &returned));
    }
    let value = FreeMonadRecProbe_run(FreeMonadRecProbe_payload(mk_string("done")));
    assert_eq!(value.unwrap_string(), "done");
}

#[test]
fn continuation_runs_once_per_loop_and_replays_shared_computations() {
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let computation = FreeMonadRecProbe_drive(
        Func1::Shared(Rc::new(move |value: Value| {
            seen.fetch_add(1, Ordering::SeqCst);
            let n = value.unwrap_int();
            FreeMonadRecProbe_fromStep(Rc::new(if n < 4 {
                Step::Loop(mk_int(n + 1))
            } else {
                Step::Done(mk_string("finished"))
            }))
        })),
        mk_int(0),
    );
    // tailRecM constructs k(seed) immediately; subsequent k calls are queued.
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        FreeMonadRecProbe_run(computation.clone()).unwrap_string(),
        "finished"
    );
    assert_eq!(calls.load(Ordering::SeqCst), 5);
    assert_eq!(
        FreeMonadRecProbe_run(computation).unwrap_string(),
        "finished"
    );
    assert_eq!(calls.load(Ordering::SeqCst), 9);
}

#[test]
fn function_payload_is_returned_without_execution() {
    let calls = Rc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let action = Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(42)
    }));
    let computation = FreeMonadRecProbe_payload(Value::Func1(action.clone()));
    let returned = FreeMonadRecProbe_run(computation).unwrap_func1();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    match (&action, &returned) {
        (Func1::Shared(a), Func1::Shared(b)) => assert!(Rc::ptr_eq(a, b)),
        _ => panic!("Done replaced the function payload"),
    }
    assert_eq!(returned(Value::Unit).unwrap_int(), 42);
    assert_eq!(returned(Value::Unit).unwrap_int(), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[test]
fn malformed_foreign_payload_is_checked_not_reinterpreted_as_step() {
    // Rust can violate Free's erased type parameter. The carrier boundary
    // must reject this Int when the continuation requires a native Step.
    let computation = FreeMonadRecProbe_drive(
        Func1::Static(|_| FreeMonadRecProbe_payload(mk_int(42))),
        Value::Unit,
    );
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        FreeMonadRecProbe_run(computation)
    }));
    assert!(result.is_err());
}
