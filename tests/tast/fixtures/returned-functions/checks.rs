use purust_core::*;
use Purs_ReturnedFunctions::*;
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::{cell::Cell, rc::Rc};

static ALLOCS: AtomicUsize = AtomicUsize::new(0);
static FREES: AtomicUsize = AtomicUsize::new(0);
struct Counter;
unsafe impl GlobalAlloc for Counter {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        FREES.fetch_add(1, Ordering::Relaxed);
        System.dealloc(ptr, layout)
    }
}
#[global_allocator]
static GLOBAL: Counter = Counter;

fn main() {
    for n in [0, 1, 2, 17, 1000] {
        let calls = Rc::new(Cell::new(0));
        let counter = calls.clone();
        let f = Func1::Shared(Rc::new(move |_| {
            counter.set(counter.get() + 1);
            -7
        }));
        for expected in 1..=3 {
            assert_eq!(ReturnedFunctions_build(n, f.clone(), ()), n - 7);
            assert_eq!(calls.get(), expected);
        }
        assert_eq!(ReturnedFunctions_partial(n, f.clone(), ()), n - 7);
        assert_eq!(calls.get(), 4);
        for initial in [-42, 0, 17] {
            assert_eq!(ReturnedFunctions_reuse(n, initial), 2 * (n + initial));
        }
        let binary = Func2::Static(|x, y| 2 * x - y);
        assert_eq!(ReturnedFunctions_binary(n, binary.clone(), 20, 3), 37 + n);
        assert_eq!(ReturnedFunctions_binary(n, binary, -5, 7), -17 + n);
        let counter = calls.clone();
        let later = Func1::Shared(Rc::new(move |x| {
            counter.set(counter.get() + 1);
            x * 2
        }));
        assert_eq!(ReturnedFunctions_deferred(n, later.clone(), 5), 2 * (5 + n));
        assert_eq!(ReturnedFunctions_deferred(n, later, -5), 2 * (n - 5));
        assert_eq!(calls.get(), 6);
        let replay_calls = Rc::new(Cell::new(0));
        let counter = replay_calls.clone();
        let replay = Func1::Shared(Rc::new(move |_| {
            counter.set(counter.get() + 1);
            counter.get()
        }));
        assert_eq!(ReturnedFunctions_reuseCaptured(n, replay), 2 * n + 3);
        assert_eq!(replay_calls.get(), 2, "A shared thunk must be forced again");
        let record = ReturnedFunctions_recordLoop(n, Func1::Static(ReturnedFunctions_recordBase), ());
        assert_eq!(record.get_state().unwrap_int(), 42);
        assert_eq!(ReturnedFunctions_generic(n,
            Func1::Static(|x: Value| mk_int(x.unwrap_int() + 1)), mk_int(7)).unwrap_int(), n + 8);
        assert_eq!(ReturnedFunctions_generic(n,
            Func1::Static(|x: Value| mk_number(x.unwrap_number() + 0.5)), mk_number(7.25)).unwrap_number(),
            7.25 + 0.5 * (n + 1) as f64);
    }
    let allocations = ALLOCS.load(Ordering::Relaxed);
    let frees = FREES.load(Ordering::Relaxed);
    let result = ReturnedFunctions_build(std::hint::black_box(1000), Func1::Static(|_| 0), ());
    let allocations = ALLOCS.load(Ordering::Relaxed) - allocations;
    let frees = FREES.load(Ordering::Relaxed) - frees;
    assert_eq!(result, 1000);
    assert_eq!(allocations, frees);
    assert!(allocations <= 1000, "At most one allocation per useful thunk: {allocations}");
    println!("Returned functions: results, partial applications, replay, recursion and allocation budget checked.");
}
