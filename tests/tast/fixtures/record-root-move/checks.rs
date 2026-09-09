use purust_core::*;
use perceus_ptr::PerceusPtr;
use Purs_RecordRootMove::*;
use std::rc::Rc;
use std::cell::RefCell;

fn pair(a: i64, b: i64) -> Value {
    Value::Record_a_b(PerceusPtr::new(Record_a_b { a: Some(mk_int(a)), b: Some(mk_int(b)) }))
}
fn values(r: &Value) -> [i64; 2] { [r.get_a().unwrap_int(), r.get_b().unwrap_int()] }
fn address(r: &Value) -> usize {
    let Value::Record_a_b(ptr) = r else { panic!("pair") };
    &**ptr as *const Record_a_b as usize
}
fn main() {
    for (a, b) in [(0, 0), (7, 11), (-3, 9)] {
        let original = pair(a, b); let ptr = address(&original);
        let changed = RecordRootMove_bump(original);
        assert_eq!(values(&changed), [a + 1, b + 2]);
        assert_eq!(address(&changed), ptr, "A unique root is reused");
        let original = pair(a, b); let ptr = address(&original);
        let changed = RecordRootMove_bump(original.clone());
        assert_eq!(values(&changed), [a + 1, b + 2]);
        assert_eq!(values(&original), [a, b]);
        assert_ne!(address(&changed), ptr, "Shared roots keep copying");
        assert_eq!(values(&RecordRootMove_swap(pair(a, b))), [b, a]);
        let both = RecordRootMove_retain(pair(a, b));
        let Versions::Versions(new, old) = both.as_ref();
        assert_eq!(values(new), [a + 1, b + 2]);
        assert_eq!(values(old), [a, b]);
    }
    let calls = Rc::new(RefCell::new(Vec::new()));
    let old = pair(5, 9);
    let trace = calls.clone(); let observed = old.clone();
    let first = Func1::Shared(Rc::new(move |x| {
        trace.borrow_mut().push(x); assert_eq!(values(&observed), [5, 9]); x + 10
    }));
    let trace = calls.clone(); let observed = old.clone();
    let second = Func1::Shared(Rc::new(move |x| {
        trace.borrow_mut().push(x); assert_eq!(values(&observed), [5, 9]); x * 2
    }));
    let changed = RecordRootMove_callback(first, second, old.clone());
    assert_eq!(*calls.borrow(), [5, 9]); assert_eq!(values(&changed), [15, 18]);
    assert_eq!(values(&old), [5, 9]); assert_eq!(Rc::strong_count(&calls), 1);
    calls.borrow_mut().clear();
    let trace = calls.clone();
    let make = Func1::Shared(Rc::new(move |r| {
        trace.borrow_mut().push(99); assert_eq!(values(&r), [5, 9]); pair(100, 200)
    }));
    assert_eq!(values(&RecordRootMove_fromCall(make, old.clone())), [6, 11]);
    assert_eq!(*calls.borrow(), [99]);

    let old = Value::Record_a_b(PerceusPtr::new(Record_a_b {
        a: Some(mk_int(7)), b: Some(Value::Func1(Func1::Static(|_| mk_int(99))))
    }));
    let changed = RecordRootMove_capture(old);
    assert_eq!(changed.get_a().unwrap_int(), 8);
    assert_eq!((changed.get_b().unwrap_func1())(Value::Unit).unwrap_int(), 7,
        "A replacement closure retains the old root, so mutation must copy it");
    let saved = RecordRootMove_capturedBase(pair(7, 11));
    assert_eq!(values(&RecordRootMove_useSaved(saved.clone(), 2)), [7, 13]);
    assert_eq!(values(&RecordRootMove_useSaved(saved, 3)), [7, 14]);

    std::panic::set_hook(Box::new(|_| {}));
    calls.borrow_mut().clear();
    let trace = calls.clone();
    let first = Func1::Shared(Rc::new(move |x| { trace.borrow_mut().push(x); x + 1 }));
    let trace = calls.clone();
    let second = Func1::Shared(Rc::new(move |x| -> i64 { trace.borrow_mut().push(x); panic!("second") }));
    let old = pair(3, 4);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callback(first, second, old.clone()))).is_err());
    assert_eq!(*calls.borrow(), [3, 4]); assert_eq!(values(&old), [3, 4]);
    assert_eq!(Rc::strong_count(&calls), 1);
    let old = pair(i64::MAX, 0);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_bump(old.clone()))).is_err());
    assert_eq!(values(&old), [i64::MAX, 0]);

    // A staged callback result must release its captures when a later RHS fails.
    let drops = Rc::new(()); let held = drops.clone();
    let first = Func1::Shared(Rc::new(move |_: Rc<Payload>| {
        let held = held.clone();
        Rc::new(Payload::Payload(Func1::Shared(Rc::new(move |_| { let _keep = &held; 10 }))))
    }));
    let second = Func1::Static(|_: Rc<Payload>| -> Rc<Payload> { panic!("second payload") });
    let r = RecordRootMove_payloads(());
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callbackPayloads(first, second, r))).is_err());
    assert_eq!(Rc::strong_count(&drops), 1);
    println!("Record root move: unique addresses, shared roots, last uses, callback order, captured old roots, repeated closures, panic/overflow and temporary drops checked.");
}
