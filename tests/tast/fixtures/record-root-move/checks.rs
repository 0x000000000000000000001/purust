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
fn nested() -> Value {
    Value::Record_a_b(PerceusPtr::new(Record_a_b {
        a: Some(mk_int(5)), b: Some(Value::Record_c_d(PerceusPtr::new(Record_c_d {
            c: Some(mk_int(7)), d: Some(mk_int(11))
        })))
    }))
}
fn nested_values(r: &Value) -> [i64; 3] {
    [r.get_a().unwrap_int(), r.get_b().get_c().unwrap_int(), r.get_b().get_d().unwrap_int()]
}
fn child_address(r: &Value) -> usize {
    let Value::Record_c_d(ptr) = r.get_b() else { panic!("child") };
    &*ptr as *const Record_c_d as usize
}
fn check_child_reuse() {
    let plus = || Func1::Static(|x: i64| x + 1);
    let r = nested(); let root_ptr = address(&r); let child_ptr = child_address(&r);
    let changed = RecordRootMove_callbackNested(plus(), plus(), plus(), r);
    assert_eq!(nested_values(&changed), [6, 8, 12]);
    assert_eq!(address(&changed), root_ptr); assert_eq!(child_address(&changed), child_ptr);
    let r = nested(); let old = r.clone();
    let changed = RecordRootMove_callbackNested(plus(), plus(), plus(), r);
    assert_eq!(nested_values(&old), [5, 7, 11]);
    assert_eq!(nested_values(&changed), [6, 8, 12]);
    assert_ne!(address(&changed), address(&old));
    assert_ne!(child_address(&changed), child_address(&old));
    let r = nested(); let root_ptr = address(&r); let child_ptr = child_address(&r);
    let kept_child = r.get_b();
    let changed = RecordRootMove_callbackNested(plus(), plus(), plus(), r);
    assert_eq!(address(&changed), root_ptr);
    assert_ne!(child_address(&changed), child_ptr);
    assert_eq!([kept_child.get_c().unwrap_int(), kept_child.get_d().unwrap_int()], [7, 11]);
    assert_eq!(nested_values(&changed), [6, 8, 12]);

    let calls = Rc::new(RefCell::new(Vec::new()));
    let old = nested();
    let callback = || {
        let old = old.clone(); let calls = calls.clone();
        Func1::Shared(Rc::new(move |x: i64| {
            calls.borrow_mut().push(x); assert_eq!(nested_values(&old), [5, 7, 11]); x + 1
        }))
    };
    let changed = RecordRootMove_callbackNested(callback(), callback(), callback(), old.clone());
    assert_eq!(*calls.borrow(), [5, 7, 11]);
    assert_eq!(nested_values(&changed), [6, 8, 12]);
    assert_eq!(nested_values(&old), [5, 7, 11]);
    calls.borrow_mut().clear();
    let fail = Func1::Static(|_: i64| -> i64 { panic!("third RHS") });
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callbackNested(callback(), callback(), fail, old.clone()))).is_err());
    assert_eq!(*calls.borrow(), [5, 7]);
    assert_eq!(nested_values(&old), [5, 7, 11]);

    let mut r = nested(); let mut b = r.get_b();
    b.set_d(Value::Func1(Func1::Static(|_| mk_int(99)))); r.set_b(b);
    let changed = RecordRootMove_captureChild(r);
    assert_eq!(changed.get_b().get_c().unwrap_int(), 8);
    assert_eq!((changed.get_b().get_d().unwrap_func1())(Value::Unit).unwrap_int(), 7,
        "The new child closure must retain the old root and child");

    let drops = Rc::new(()); let held = drops.clone();
    let first = Func1::Shared(Rc::new(move |_: Rc<Payload>| {
        let held = held.clone();
        Rc::new(Payload::Payload(Func1::Shared(Rc::new(move |_| { let _keep = &held; 10 }))))
    }));
    let second = Func1::Static(|_: Rc<Payload>| -> Rc<Payload> { panic!("child payload") });
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callbackNestedPayloads(first, second, RecordRootMove_nestedPayloads(())))).is_err());
    assert_eq!(Rc::strong_count(&drops), 1, "Staged child values release their captures on panic");
}
fn deep() -> Value {
    Value::Record_a_b(PerceusPtr::new(Record_a_b {
        a: Some(mk_int(5)), b: Some(Value::Record_c_d(PerceusPtr::new(Record_c_d {
            c: Some(mk_int(7)), d: Some(Value::Record_e_f(PerceusPtr::new(Record_e_f {
                e: Some(mk_int(11)), f: Some(mk_int(13))
            })))
        })))
    }))
}
fn deep_values(r: &Value) -> [i64; 4] {
    [r.get_a().unwrap_int(), r.get_b().get_c().unwrap_int(),
     r.get_b().get_d().get_e().unwrap_int(), r.get_b().get_d().get_f().unwrap_int()]
}
fn leaf_address(r: &Value) -> usize {
    let Value::Record_e_f(ptr) = r.get_b().get_d() else { panic!("leaf") };
    &*ptr as *const Record_e_f as usize
}
fn check_record_path() {
    for mask in 0..8 {
        let r = deep();
        let pointers = [address(&r), child_address(&r), leaf_address(&r)];
        let root = if mask & 1 != 0 { Some(r.clone()) } else { None };
        let child = if mask & 2 != 0 { Some(r.get_b()) } else { None };
        let leaf = if mask & 4 != 0 { Some(r.get_b().get_d()) } else { None };
        let changed = RecordRootMove_updateDeep(10, r);
        assert_eq!(deep_values(&changed), [15, 27, 41, 33]);
        assert_eq!(address(&changed) == pointers[0], mask & 1 == 0);
        assert_eq!(child_address(&changed) == pointers[1], mask & 3 == 0);
        assert_eq!(leaf_address(&changed) == pointers[2], mask == 0);
        if let Some(r) = root { assert_eq!(deep_values(&r), [5, 7, 11, 13]); }
        if let Some(b) = child {
            assert_eq!(b.get_c().unwrap_int(), 7);
            assert_eq!(b.get_d().get_e().unwrap_int(), 11);
            assert_eq!(b.get_d().get_f().unwrap_int(), 13);
        }
        if let Some(d) = leaf {
            assert_eq!(d.get_e().unwrap_int(), 11); assert_eq!(d.get_f().unwrap_int(), 13);
        }
    }
    let calls = Rc::new(RefCell::new(Vec::new()));
    let old = deep();
    let callback = || {
        let old = old.clone(); let calls = calls.clone();
        Func1::Shared(Rc::new(move |x: i64| {
            calls.borrow_mut().push(x); assert_eq!(deep_values(&old), [5, 7, 11, 13]); x + 1
        }))
    };
    let changed = RecordRootMove_callbackDeep(callback(), callback(), callback(), callback(), old.clone());
    assert_eq!(deep_values(&changed), [6, 8, 12, 14]);
    assert_eq!(*calls.borrow(), [5, 7, 11, 13]);
    calls.borrow_mut().clear();
    let fail = Func1::Static(|_: i64| -> i64 { panic!("leaf RHS") });
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callbackDeep(callback(), callback(), callback(), fail, old.clone()))).is_err());
    assert_eq!(*calls.borrow(), [5, 7, 11]);
    assert_eq!(deep_values(&old), [5, 7, 11, 13]);
    let mut r = deep(); let mut b = r.get_b(); let mut d = b.get_d();
    d.set_f(Value::Func1(Func1::Static(|_| mk_int(99)))); b.set_d(d); r.set_b(b);
    let changed = RecordRootMove_captureLeaf(r);
    assert_eq!(changed.get_b().get_d().get_e().unwrap_int(), 12);
    assert_eq!((changed.get_b().get_d().get_f().unwrap_func1())(Value::Unit).unwrap_int(), 11);

    let drops = Rc::new(()); let held = drops.clone();
    let first = Func1::Shared(Rc::new(move |_: Rc<Payload>| {
        let held = held.clone();
        Rc::new(Payload::Payload(Func1::Shared(Rc::new(move |_| { let _keep = &held; 10 }))))
    }));
    let second = Func1::Static(|_: Rc<Payload>| -> Rc<Payload> { panic!("leaf payload") });
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordRootMove_callbackDeepPayloads(first, second, RecordRootMove_deepPayloads(())))).is_err());
    assert_eq!(Rc::strong_count(&drops), 1);
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
    check_child_reuse();
    check_record_path();
    println!("Record path reuse: unique addresses, all 8 root/child/leaf sharing masks, last uses, callback order, captured old versions, repeated closures, panic/overflow and temporary drops checked.");
}
