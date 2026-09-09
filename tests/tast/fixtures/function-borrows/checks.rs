use purust_core::{Func1, Func2};
use std::cell::{Cell, RefCell};
use std::rc::{Rc, Weak};
use Purs_FunctionBorrows::*;

type Unary = dyn Fn(i64) -> i64;
type Binary = dyn Fn(i64, i64) -> i64;
type Recursive = dyn Fn(Rc<Callback>) -> i64;

fn unary() -> (Func1<i64, i64>, Weak<Unary>, Rc<Cell<usize>>) {
    let calls = Rc::new(Cell::new(0));
    let seen = calls.clone();
    let slot = Rc::new(RefCell::new(None::<Weak<Unary>>));
    let observer = slot.clone();
    let f: Rc<Unary> = Rc::new(move |k| {
        assert_eq!(
            observer.borrow().as_ref().unwrap().strong_count(),
            1,
            "The call must borrow the sole captured/parameter function"
        );
        seen.set(seen.get() + 1);
        k + 10
    });
    let weak = Rc::downgrade(&f);
    *slot.borrow_mut() = Some(weak.clone());
    (Func1::Shared(f), weak, calls)
}

fn direct_and_captured() {
    let (f, weak, calls) = unary();
    assert_eq!(FunctionBorrows_callTwice(f, 7), 35);
    assert_eq!(calls.get(), 2);
    assert!(weak.upgrade().is_none());

    let (f, weak, calls) = unary();
    assert_eq!(FunctionBorrows_nestedCalls(f, 7), 27);
    assert_eq!(calls.get(), 2);
    assert!(weak.upgrade().is_none());

    let (f, weak, calls) = unary();
    let saved = Rc::new(RefCell::new(None::<Func1<(), i64>>));
    let keep = saved.clone();
    let result = FunctionBorrows_throughCapture(
        f,
        7,
        Func1::Shared(Rc::new(move |thunk| {
            let result = thunk(()) + thunk(());
            *keep.borrow_mut() = Some(thunk);
            result
        })),
    );
    assert_eq!(result, 34);
    assert_eq!(calls.get(), 2);
    assert!(weak.upgrade().is_some());
    let thunk = saved.borrow_mut().take().unwrap();
    assert_eq!(thunk(()), 17);
    assert_eq!(calls.get(), 3);
    drop(thunk);
    assert!(weak.upgrade().is_none());
}

fn binary_and_partial() {
    let slot = Rc::new(RefCell::new(None::<Weak<Binary>>));
    let observer = slot.clone();
    let f: Rc<Binary> = Rc::new(move |x, y| {
        assert_eq!(observer.borrow().as_ref().unwrap().strong_count(), 1);
        100 * x + y
    });
    let weak = Rc::downgrade(&f);
    *slot.borrow_mut() = Some(weak.clone());
    assert_eq!(FunctionBorrows_binaryTwice(Func2::Shared(f), 7), 1403);
    assert!(weak.upgrade().is_none());

    let f: Rc<Binary> = Rc::new(|x, y| 100 * x + y);
    let weak = Rc::downgrade(&f);
    let saved = Rc::new(RefCell::new(None::<Func1<i64, i64>>));
    let keep = saved.clone();
    let result = FunctionBorrows_holdPartial(
        Func2::Shared(f),
        7,
        Func1::Shared(Rc::new(move |g| {
            let result = g(5) + g(6);
            *keep.borrow_mut() = Some(g);
            result
        })),
    );
    assert_eq!(result, 1614);
    assert!(
        weak.upgrade().is_some(),
        "The partial application must own its callee"
    );
    let g = saved.borrow_mut().take().unwrap();
    assert_eq!(g(8), 708);
    drop(g);
    assert!(weak.upgrade().is_none());
}

fn callee_in_arguments() {
    for call in [FunctionBorrows_passSelf, FunctionBorrows_captureSelf] {
        let slot = Rc::new(RefCell::new(None::<Weak<Recursive>>));
        let observer = slot.clone();
        let f: Rc<Recursive> = Rc::new(move |arg| {
            assert_eq!(
                observer.borrow().as_ref().unwrap().strong_count(),
                2,
                "One owner for the callee and one for the argument/capture"
            );
            let Callback::Callback(_) = arg.as_ref();
            42
        });
        let weak = Rc::downgrade(&f);
        *slot.borrow_mut() = Some(weak.clone());
        assert_eq!(call(Func1::Shared(f)), 42);
        assert!(weak.upgrade().is_none());
    }
}

fn main() {
    direct_and_captured();
    binary_and_partial();
    callee_in_arguments();
    println!("Function calls borrow native Func1/Func2; captures replay, partial applications own their callees, callee arguments retain their owner, and all weak references expire.");
}
