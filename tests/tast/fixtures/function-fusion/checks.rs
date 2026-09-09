use purust_core::Func1;
use Purs_FunctionFusion::*;
use Purs_IteratorConsumer::IteratorConsumer_apply;
use std::cell::{Cell, RefCell};
use std::rc::Rc;

fn main() {
    for n in [0_i64, 1, 2, 3, 10, 20] {
        let trace = Rc::new(RefCell::new(Vec::new()));
        let observed = trace.clone();
        let callback = Func1::Shared(Rc::new(move |x| {
            observed.borrow_mut().push(x);
            2 * x + 1
        }));
        let result = IteratorConsumer_apply(n, callback, 0);
        let mut expected = 0;
        let mut inputs = Vec::new();
        for _ in 0..n { inputs.push(expected); expected = 2 * expected + 1; }
        assert_eq!(result, expected);
        assert_eq!(*trace.borrow(), inputs);
        assert_eq!(Rc::strong_count(&trace), 1);

        let saved = FunctionFusion_save(n);
        for seed in [-3, 0, 11] {
            assert_eq!(FunctionFusion_useSaved(saved.clone(), Func1::Static(|x| x + 2), seed), seed + 2 * n);
            assert_eq!(FunctionFusion_useSaved(saved.clone(), Func1::Static(|x| x - 1), seed), seed - n);
        }
    }
    let calls = Rc::new(Cell::new(0));
    let observed = calls.clone();
    let saved = FunctionFusion_saveCallback(7, Func1::Shared(Rc::new(move |x| {
        observed.set(observed.get() + 1);
        x + 2
    })));
    assert_eq!(calls.get(), 0, "Saving the callback must not apply it");
    assert_eq!(FunctionFusion_useApplied(saved.clone(), 3), 17);
    assert_eq!(FunctionFusion_useApplied(saved.clone(), 10), 24);
    assert_eq!(calls.get(), 14);
    drop(saved);
    assert_eq!(Rc::strong_count(&calls), 1);

    assert_eq!(FunctionFusion_byTwo(6, Func1::Static(|x| x + 1), 0), 3);
    assert_eq!(FunctionFusion_nonIdentity(6, Func1::Static(|x| x + 1), 0), 7);
    assert_eq!(FunctionFusion_withCounter(3, Func1::Static(|x| 2 * x), 0), 22);

    std::panic::set_hook(Box::new(|_| {}));
    calls.set(0);
    let observed = calls.clone();
    let callback = Func1::Shared(Rc::new(move |x| {
        observed.set(observed.get() + 1);
        if x == 3 { panic!("stop") }
        x + 1
    }));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        FunctionFusion_repeat(10, callback, 0))).is_err());
    assert_eq!(calls.get(), 4);
    assert_eq!(Rc::strong_count(&calls), 1);
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        FunctionFusion_repeat(1, Func1::Static(|x| x + 1), i64::MAX))).is_err());
    // The first decrement overflows immediately on this negative FFI input.
    // Keeping the old path must panic before applying the callback at all.
    calls.set(0);
    let observed = calls.clone();
    let callback = Func1::Shared(Rc::new(move |x| { observed.set(observed.get() + 1); x }));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        FunctionFusion_repeat(i64::MIN, callback, 0))).is_err());
    assert_eq!(calls.get(), 0);
    assert_eq!(Rc::strong_count(&calls), 1);
    println!("Function fusion: callback traces, zero, saved/partially applied functions, cross-module calls, capture drops, panic/overflow and near misses checked.");
}
