use purust_core::Func1;
use std::alloc::{GlobalAlloc, Layout, System};
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_SharedNullaries::*;
static ALLOCS: AtomicUsize = AtomicUsize::new(0);
static FREES: AtomicUsize = AtomicUsize::new(0);
struct Counter;
unsafe impl GlobalAlloc for Counter {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        System.alloc(l)
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        FREES.fetch_add(1, Ordering::Relaxed);
        System.dealloc(p, l)
    }
}
#[global_allocator]
static GLOBAL: Counter = Counter;
fn node(t: &Tree) -> (&Rc<Tree>, i64, &Rc<Tree>) {
    if let Tree::Node(l, k, r) = t {
        (l, *k, r)
    } else {
        panic!("expected Node")
    }
}
fn leaf_checks() -> usize {
    let start = ALLOCS.load(Ordering::Relaxed);
    let first = SharedNullaries_leaf(7);
    let cost = ALLOCS.load(Ordering::Relaxed) - start;
    let (l, k, r) = node(&first);
    assert_eq!(cost, 2);
    assert_eq!(k, 7);
    assert!(matches!(l.as_ref(), Tree::Empty) && matches!(r.as_ref(), Tree::Empty));
    assert!(Rc::ptr_eq(l, r));
    let weak = Rc::downgrade(l);
    let second = SharedNullaries_leaf(8);
    assert!(
        !Rc::ptr_eq(l, node(&second).0),
        "Sharing stays local to each construction"
    );
    let old = first.clone();
    let changed = SharedNullaries_changeRoot(first);
    assert_eq!((node(&old).1, node(&changed).1), (7, 8));
    assert!(weak.upgrade().is_some());
    drop(changed);
    assert!(weak.upgrade().is_some());
    drop(old);
    assert!(weak.upgrade().is_none(), "There is no retained cache root");
    cost
}
fn nested_checks() {
    let start = ALLOCS.load(Ordering::Relaxed);
    let nested = SharedNullaries_nested(11);
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - start, 5);
    let Bundle::Bundle(a, b, c, d) = nested.as_ref();
    assert!(Rc::ptr_eq(a, c));
    let (l, k, r) = node(b);
    assert_eq!(k, 11);
    assert!(Rc::ptr_eq(l, r));
    assert!(
        !Rc::ptr_eq(a, l),
        "Nested bindings must not capture the enclosing shared value"
    );
    assert!(matches!(d.as_ref(), Tree::End));
    assert!(
        !Rc::ptr_eq(a, d),
        "Different nullary constructors remain distinct"
    );
    let mixed = SharedNullaries_mixed();
    let Mixed::Mixed(a, b, c, d) = mixed.as_ref();
    assert!(Rc::ptr_eq(a, c));
    assert!(Rc::ptr_eq(b, d));
    assert!(matches!(a.as_ref(), Tree::Empty));
    assert!(matches!(b.as_ref(), Purs_OtherNullaries::Other::Empty));
}
fn call_checks() {
    let seen = Rc::new(std::cell::Cell::new(0));
    let observed = seen.clone();
    let result = SharedNullaries_fromFactory(
        Func1::Shared(Rc::new(move |k| {
            observed.set(observed.get() * 100 + k);
            SharedNullaries_leaf(k)
        })),
        7,
    );
    assert_eq!(
        seen.get(),
        708,
        "Function calls stay separate and keep their order"
    );
    assert_eq!((node(node(&result).0).1, node(node(&result).2).1), (7, 8));
}
fn main() {
    let a = ALLOCS.load(Ordering::Relaxed);
    let f = FREES.load(Ordering::Relaxed);
    let cost = leaf_checks();
    nested_checks();
    call_checks();
    assert_eq!(
        ALLOCS.load(Ordering::Relaxed) - a,
        FREES.load(Ordering::Relaxed) - f,
        "All cells and weak control blocks are freed"
    );
    println!("Leaf allocations={cost}; local and nested sharing, imported types, persistence, weak references and call order checked; all allocations freed.");
}
