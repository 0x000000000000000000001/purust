use lazy_ffi::{Data_Lazy_defer as defer, Data_Lazy_force as force, Lazy};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::rc::Rc;
#[cfg(not(feature = "threaded"))]
use std::rc::Weak;
#[cfg(feature = "threaded")]
use std::sync::Weak;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc, Mutex,
};

#[test]
fn memoization_preserves_shared_identity_and_releases_captures() {
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let capture = Rc::new(());
    let capture_weak = Rc::downgrade(&capture);
    let array = Rc::new(vec![mk_int(42)]);
    let result_weak = Rc::downgrade(&array);
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        let _keep = &capture;
        seen.fetch_add(1, Ordering::SeqCst);
        Value::Array(array.clone())
    })));
    let alias = lazy.clone();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(capture_weak.upgrade().is_some());
    let first = force(lazy.clone()).unwrap_array();
    let second = force(alias.clone()).unwrap_array();
    assert!(Rc::ptr_eq(&first, &second));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(capture_weak.upgrade().is_none());
    // Exercise the same opaque wrapper used at polymorphic call sites.
    let boxed = Value::Class(Rc::new(alias.clone()));
    let recovered = boxed.unwrap_class::<Rc<Lazy>>().clone();
    assert!(Rc::ptr_eq(&lazy, &recovered));
    assert!(Rc::ptr_eq(&first, &force(recovered.clone()).unwrap_array()));
    drop((first, second, recovered, boxed, lazy));
    assert!(result_weak.upgrade().is_some());
    drop(alias);
    assert!(result_weak.upgrade().is_none());
}

#[test]
fn unforced_destruction_releases_the_initializer() {
    let capture = Rc::new(());
    let weak = Rc::downgrade(&capture);
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        let _keep = &capture;
        panic!("must not evaluate an unforced value")
    })));
    drop(lazy);
    assert!(weak.upgrade().is_none());
}

#[test]
fn returned_functions_and_nested_lazy_values_remain_deferred() {
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let action = Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        mk_int(42)
    }));
    let original = action.clone();
    let inner = defer(Func1::Shared(Rc::new(move |_| {
        Value::Func1(action.clone())
    })));
    let inner_copy = inner.clone();
    let outer = defer(Func1::Shared(Rc::new(move |_| {
        Value::Class(Rc::new(inner_copy.clone()))
    })));
    let returned_inner = force(outer).unwrap_class::<Rc<Lazy>>().clone();
    assert!(Rc::ptr_eq(&inner, &returned_inner));
    let returned = force(returned_inner).unwrap_func1();
    match (&original, &returned) {
        (Func1::Shared(a), Func1::Shared(b)) => assert!(Rc::ptr_eq(a, b)),
        _ => panic!("captured function replaced"),
    }
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(returned(Value::Unit).unwrap_int(), 42);
    assert_eq!(force(inner).unwrap_func1()(Value::Unit).unwrap_int(), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[test]
fn panic_payload_is_preserved_and_success_can_be_retried() {
    let attempts = Arc::new(AtomicUsize::new(0));
    let seen = attempts.clone();
    let marker = Arc::new(());
    let original = marker.clone();
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        if seen.fetch_add(1, Ordering::SeqCst) == 0 {
            std::panic::panic_any(marker.clone());
        }
        mk_int(42)
    })));
    let error = catch_unwind(AssertUnwindSafe(|| force(lazy.clone())))
        .err()
        .unwrap();
    assert!(Arc::ptr_eq(
        error.downcast_ref::<Arc<()>>().unwrap(),
        &original
    ));
    assert_eq!(force(lazy.clone()).unwrap_int(), 42);
    assert_eq!(force(lazy).unwrap_int(), 42);
    assert_eq!(attempts.load(Ordering::SeqCst), 2);
}

#[test]
fn repeated_panics_are_not_cached() {
    let attempts = Arc::new(AtomicUsize::new(0));
    let seen = attempts.clone();
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        panic!("every attempt")
    })));
    for _ in 0..2 {
        let error = catch_unwind(AssertUnwindSafe(|| force(lazy.clone())))
            .err()
            .unwrap();
        assert_eq!(error.downcast_ref::<&str>(), Some(&"every attempt"));
    }
    assert_eq!(attempts.load(Ordering::SeqCst), 2);
}

#[test]
fn same_cell_reentrancy_panics_and_restores_the_initializer() {
    let slot = Rc::new(Mutex::new(Weak::<Lazy>::new()));
    let captured = slot.clone();
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        let this = captured.lock().unwrap().upgrade().unwrap();
        force(this)
    })));
    *slot.lock().unwrap() = Rc::downgrade(&lazy);
    for _ in 0..2 {
        let error = catch_unwind(AssertUnwindSafe(|| force(lazy.clone())))
            .err()
            .unwrap();
        assert_eq!(
            error.downcast_ref::<&str>(),
            Some(&"Data.Lazy.force: reentrant evaluation")
        );
    }
    drop(lazy);
    assert!(slot.lock().unwrap().upgrade().is_none());
}

#[test]
fn catching_reentrancy_inside_the_callback_can_still_publish_a_result() {
    let slot = Rc::new(Mutex::new(Weak::<Lazy>::new()));
    let captured = slot.clone();
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        let this = captured.lock().unwrap().upgrade().unwrap();
        assert!(catch_unwind(AssertUnwindSafe(|| force(this))).is_err());
        mk_int(42)
    })));
    *slot.lock().unwrap() = Rc::downgrade(&lazy);
    assert_eq!(force(lazy.clone()).unwrap_int(), 42);
    assert_eq!(force(lazy).unwrap_int(), 42);
}

#[test]
fn a_different_cell_can_be_forced_during_evaluation() {
    let inner = defer(Func1::Static(|_| mk_int(41)));
    let outer = defer(Func1::Shared(Rc::new(move |_| {
        mk_int(force(inner.clone()).unwrap_int() + 1)
    })));
    assert_eq!(force(outer.clone()).unwrap_int(), 42);
    assert_eq!(force(outer).unwrap_int(), 42);
}

#[cfg(feature = "threaded")]
fn contended_force(panic_first: bool) {
    use std::sync::{mpsc, Barrier};
    use std::time::Duration;
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<Lazy>();
    let attempts = Arc::new(AtomicUsize::new(0));
    let seen = attempts.clone();
    let (entered_tx, entered_rx) = mpsc::channel();
    let release = Arc::new(Barrier::new(2));
    let callback_release = release.clone();
    let array = Arc::new(vec![mk_int(42)]);
    let result = array.clone();
    let lazy = defer(Func1::Shared(Rc::new(move |_| {
        if seen.fetch_add(1, Ordering::SeqCst) == 0 {
            entered_tx.send(()).unwrap();
            callback_release.wait();
            if panic_first {
                panic!("first reader");
            }
        }
        Value::Array(array.clone())
    })));
    let first_value = lazy.clone();
    let first = std::thread::spawn(move || catch_unwind(AssertUnwindSafe(|| force(first_value))));
    entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
    let barrier = Arc::new(Barrier::new(9));
    let (done_tx, done_rx) = mpsc::channel();
    let readers: Vec<_> = (0..8)
        .map(|_| {
            let (barrier, done, value) = (barrier.clone(), done_tx.clone(), lazy.clone());
            std::thread::spawn(move || {
                barrier.wait();
                let returned = force(value).unwrap_array();
                done.send(()).unwrap();
                returned
            })
        })
        .collect();
    barrier.wait();
    assert!(matches!(
        done_rx.recv_timeout(Duration::from_millis(30)),
        Err(mpsc::RecvTimeoutError::Timeout)
    ));
    assert_eq!(attempts.load(Ordering::SeqCst), 1);
    release.wait();
    let first_result = first.join().unwrap();
    if panic_first {
        assert_eq!(
            first_result.err().unwrap().downcast_ref::<&str>(),
            Some(&"first reader")
        );
    } else {
        assert!(Arc::ptr_eq(
            &first_result.ok().unwrap().unwrap_array(),
            &result
        ));
    }
    for reader in readers {
        done_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(Arc::ptr_eq(&reader.join().unwrap(), &result));
    }
    assert_eq!(
        attempts.load(Ordering::SeqCst),
        if panic_first { 2 } else { 1 }
    );
    assert!(Arc::ptr_eq(&force(lazy).unwrap_array(), &result));
}

#[cfg(feature = "threaded")]
#[test]
fn concurrent_readers_share_one_successful_evaluation() {
    for _ in 0..8 {
        contended_force(false);
    }
}

#[cfg(feature = "threaded")]
#[test]
fn a_panicking_reader_wakes_waiters_for_retry() {
    for _ in 0..8 {
        contended_force(true);
    }
}
