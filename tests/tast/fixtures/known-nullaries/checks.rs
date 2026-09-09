use purust_core::{Func1, Func2};
use std::alloc::{GlobalAlloc, Layout, System};
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_KnownNullaries::*;

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
        System.dealloc(p, l);
    }
}
#[global_allocator]
static GLOBAL: Counter = Counter;

fn node(tree: &Tree) -> (&Rc<Tree>, i64, &Rc<Tree>) {
    match tree {
        Tree::Node(l, k, r) => (l, *k, r),
        _ => panic!("expected Node"),
    }
}

fn seeds() {
    for (shared, weak) in [(false, false), (true, false), (false, true), (true, true)] {
        let seed = Rc::new(Tree::Empty);
        let ptr = Rc::as_ptr(&seed);
        let old = shared.then(|| seed.clone());
        let observer = weak.then(|| Rc::downgrade(&seed));
        let before = ALLOCS.load(Ordering::Relaxed);
        let tree = KnownNullaries_seeded(seed, 7);
        assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 1);
        let (l, k, r) = node(&tree);
        assert_eq!(k, 7);
        assert!(matches!(l.as_ref(), Tree::Empty));
        assert_eq!(Rc::as_ptr(l), ptr);
        assert_eq!(Rc::as_ptr(r), ptr);
        if let Some(old) = &old {
            assert!(matches!(old.as_ref(), Tree::Empty));
        }
        drop(old);
        if let Some(observer) = &observer {
            assert!(observer.upgrade().is_some());
        }
        drop(tree);
        if let Some(observer) = &observer {
            assert!(observer.upgrade().is_none());
        }
    }
}

fn constructors() {
    let seed = Rc::new(Tree::Empty);
    let ptr = Rc::as_ptr(&seed);
    let before = ALLOCS.load(Ordering::Relaxed);
    let tree = KnownNullaries_nested(seed, 11);
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 2);
    let (l, k, r) = node(&tree);
    let (rl, rk, rr) = node(r);
    assert_eq!((k, rk), (11, 12));
    for empty in [l, rl, rr] {
        assert_eq!(Rc::as_ptr(empty), ptr);
        assert!(matches!(empty.as_ref(), Tree::Empty));
    }

    let seed = Rc::new(Tree::Empty);
    let ptr = Rc::as_ptr(&seed);
    let before = ALLOCS.load(Ordering::Relaxed);
    let mixed = KnownNullaries_mixed(seed);
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 2);
    let Mixed::Mixed(a, b, c, d) = mixed.as_ref();
    assert_eq!(Rc::as_ptr(a), ptr);
    assert!(Rc::ptr_eq(a, c) && Rc::ptr_eq(b, d));
    assert!(matches!(b.as_ref(), Purs_OtherNullaries::Other::Empty));

    let seed = Rc::new(Tree::Empty);
    let observer = Rc::downgrade(&seed);
    let tree = KnownNullaries_different(seed, 13);
    let (l, k, r) = node(&tree);
    assert_eq!(k, 13);
    assert!(matches!(l.as_ref(), Tree::End) && matches!(r.as_ref(), Tree::End));
    assert!(
        observer.upgrade().is_none(),
        "A different constructor must not retain the tested value"
    );

    let end = Rc::new(Tree::End);
    let ptr = Rc::as_ptr(&end);
    let before = ALLOCS.load(Ordering::Relaxed);
    let unchanged = KnownNullaries_seeded(end, 99);
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 0);
    assert_eq!(Rc::as_ptr(&unchanged), ptr);
    assert!(matches!(unchanged.as_ref(), Tree::End));
}

fn calls() {
    let seen = Rc::new(std::cell::Cell::new(0));
    let observed = seen.clone();
    let seed = Rc::new(Tree::Empty);
    let ptr = Rc::as_ptr(&seed);
    let tree = KnownNullaries_withFactory(
        seed,
        Func1::Shared(Rc::new(move |k| {
            observed.set(observed.get() + k);
            Rc::new(Tree::End)
        })),
        17,
    );
    assert_eq!(seen.get(), 17);
    assert!(matches!(node(&tree).0.as_ref(), Tree::End));
    assert_eq!(Rc::as_ptr(node(&tree).2), ptr);

    let observed = seen.clone();
    let tree = KnownNullaries_callTest(
        Func1::Shared(Rc::new(move |k| {
            observed.set(observed.get() + k);
            Rc::new(Tree::Empty)
        })),
        19,
    );
    assert_eq!(seen.get(), 36, "The tested function runs exactly once");
    assert_eq!(node(&tree).1, 19);
    assert!(matches!(node(&tree).0.as_ref(), Tree::Empty));

    let seed = Rc::new(Tree::Empty);
    let before = ALLOCS.load(Ordering::Relaxed);
    let tree = KnownNullaries_thenUse(
        seed,
        23,
        Func2::Static(|new, old| {
            assert!(matches!(old.as_ref(), Tree::Empty));
            assert!(Rc::ptr_eq(node(&new).0, &old));
            assert!(Rc::ptr_eq(node(&new).2, &old));
            new
        }),
    );
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 1);
    assert_eq!(node(&tree).1, 23);
}

fn main() {
    let a = ALLOCS.load(Ordering::Relaxed);
    let f = FREES.load(Ordering::Relaxed);
    seeds();
    constructors();
    calls();
    assert_eq!(
        ALLOCS.load(Ordering::Relaxed) - a,
        FREES.load(Ordering::Relaxed) - f
    );
    println!("Known empty: one allocation with unique/shared/weak seeds; nested and imported constructors, fallback, calls, later uses and all releases checked.");
}
