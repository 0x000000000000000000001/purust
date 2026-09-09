use Purs_ConsumedNodes::*;
use purust_core::{Func1, Func3};
use std::alloc::{GlobalAlloc, Layout, System};
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};

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

fn leaf(key: i64) -> Rc<Tree> {
    Rc::new(Tree::Node(Rc::new(Tree::Empty), key, Rc::new(Tree::Empty)))
}
fn node(tree: &Tree) -> (&Rc<Tree>, i64, &Rc<Tree>) {
    match tree {
        Tree::Node(left, key, right) => (left, *key, right),
        Tree::Empty => panic!("Expected a node"),
    }
}
fn key(tree: &Tree) -> i64 { node(tree).1 }

fn correctness() {
    for delta in [-11, 0, 7] {
        assert!(matches!(ConsumedNodes_changeRoot(delta, Rc::new(Tree::Empty)).as_ref(), Tree::Empty));
        assert!(matches!(ConsumedNodes_changeLeft(delta, Rc::new(Tree::Empty)).as_ref(), Tree::Empty));
        let tree = Rc::new(Tree::Node(leaf(3), 10, leaf(17)));
        assert_eq!(Rc::strong_count(&tree), 1);
        let (left, _, right) = node(&tree);
        let (left, right) = (left.clone(), right.clone());
        let changed = ConsumedNodes_changeRoot(delta, tree);
        let (new_left, new_key, new_right) = node(&changed);
        assert_eq!(new_key, 10 + delta);
        assert!(Rc::ptr_eq(&left, new_left));
        assert!(Rc::ptr_eq(&right, new_right));

        // The root is unique, but its two children alias the same subtree.
        let child = leaf(23);
        let tree = Rc::new(Tree::Node(child.clone(), 10, child));
        let changed = ConsumedNodes_changeLeft(delta, tree);
        let (left, root_key, right) = node(&changed);
        assert_eq!((key(left), root_key, key(right)), (23 + delta, 10, 23));

        // All reads of the retained root occur after the consuming call.
        let tree = Rc::new(Tree::Node(leaf(3), 10, leaf(17)));
        let old = tree.clone();
        let changed = ConsumedNodes_changeLeft(delta, tree);
        assert_eq!(key(node(&changed).0), 3 + delta);
        assert_eq!(key(node(&old).0), 3);
        assert_eq!(key(&old), 10);
        drop(changed);
        assert_eq!(key(node(&old).0), 3);

        // This alias is created by the generated program, not just the harness.
        let versions = ConsumedNodes_retainOriginal(delta, leaf(41));
        let Versions::Versions(changed, original) = versions.as_ref();
        assert_eq!((key(changed), key(original)), (41 + delta, 41));
    }
    for n in [0, 1, 2, 17, 1000] {
        let tree = leaf(-9);
        let old = tree.clone();
        let changed = ConsumedNodes_repeatRoot(n, 3, tree);
        assert_eq!(key(&changed), -9 + 3 * n);
        assert_eq!(key(&old), -9);
        drop(changed);
        assert_eq!(key(&old), -9);
    }
    let original = leaf(41);
    let nested = ConsumedNodes_nestOriginal(original);
    assert_eq!((key(&nested), key(node(&nested).2)), (42, 41));
    let weak = Rc::downgrade(node(&nested).2);
    drop(nested);
    assert!(weak.upgrade().is_none(), "Storing the source must not create a cycle");

    let original = leaf(41);
    let weak = Rc::downgrade(&original);
    let changed = ConsumedNodes_changeRoot(1, original);
    assert_eq!(key(&changed), 42);
    assert!(weak.upgrade().is_none(), "A weak reference must not see the changed value");

    let tree = Rc::new(Tree::Node(leaf(3), 10, leaf(17)));
    let result = ConsumedNodes_consumeFields(Func3::Static(|left, key, right| {
        assert_eq!(Rc::strong_count(&left), 1, "Move the child before calling the function");
        assert_eq!(Rc::strong_count(&right), 1);
        Rc::new(Tree::Node(ConsumedNodes_changeRoot(1, left), key, right))
    }), tree);
    assert_eq!(key(node(&result).0), 4);
    let old = result.clone();
    let changed = ConsumedNodes_consumeFields(Func3::Static(|left, key, right| {
        Rc::new(Tree::Node(ConsumedNodes_changeRoot(1, left), key, right))
    }), result);
    assert_eq!((key(node(&changed).0), key(node(&old).0)), (5, 4));

    let repeated = ConsumedNodes_reuseChild(Rc::new(Tree::Node(leaf(3), 10, leaf(17))));
    assert_eq!((key(node(&repeated).0), key(node(&repeated).2)), (4, 3));

    let calls = Rc::new(std::cell::Cell::new(0));
    let observed = calls.clone();
    let deferred = Rc::new(Deferred::Deferred(3, Func1::Shared(Rc::new(move |_| {
        observed.set(observed.get() + 1);
        7
    }))));
    let changed = ConsumedNodes_changeDeferred(deferred);
    assert_eq!(calls.get(), 0, "Transferring captures must not execute a deferred call");
    let Deferred::Deferred(key, f) = changed.as_ref() else { panic!("Expected Deferred") };
    assert_eq!(*key, 3);
    assert_eq!((f.clone()(()), f.clone()(()), calls.get()), (10, 10, 2));
}

fn allocation_budgets() -> (usize, usize, usize) {
    let iterations = std::hint::black_box(1000);
    let tree = leaf(7);
    assert_eq!(Rc::strong_count(&tree), 1);
    let start = ALLOCS.load(Ordering::Relaxed);
    let tree = ConsumedNodes_repeatRoot(iterations, 1, tree);
    let unique = ALLOCS.load(Ordering::Relaxed) - start;
    assert_eq!(key(&tree), 7 + iterations);
    assert_eq!(unique, 0, "A consumed unique root must reuse its cell");
    drop(tree);

    let mut tree = leaf(7);
    let start = ALLOCS.load(Ordering::Relaxed);
    for expected in 7..7 + iterations {
        let old = tree.clone();
        tree = ConsumedNodes_changeRoot(1, tree);
        assert_eq!((key(&old), key(&tree)), (expected, expected + 1));
        drop(old);
    }
    let shared = ALLOCS.load(Ordering::Relaxed) - start;
    assert!(shared <= iterations as usize, "Shared root: {shared}");
    drop(tree);

    let mut tree = Rc::new(Tree::Node(leaf(7), 0, leaf(17)));
    let start = ALLOCS.load(Ordering::Relaxed);
    for _ in 0..iterations { tree = ConsumedNodes_changeLeft(1, tree); }
    let path = ALLOCS.load(Ordering::Relaxed) - start;
    let (left, root_key, right) = node(&tree);
    assert_eq!((key(left), root_key, key(right)), (7 + iterations, 0, 17));
    assert_eq!(path, 0, "Both consumed nodes must remain unique during the call");
    (unique, shared, path)
}

fn calls_with_cells() -> (usize, usize) {
    let mut unique = 0;
    let mut shared = 0;
    for change in [ConsumedNodes_throughCall, ConsumedNodes_throughBranch] {
        let mut tree = leaf(7);
        let start = ALLOCS.load(Ordering::Relaxed);
        let address = Rc::as_ptr(&tree);
        for _ in 0..1000 { tree = change(tree); assert_eq!(Rc::as_ptr(&tree), address); }
        unique += ALLOCS.load(Ordering::Relaxed) - start;
        assert_eq!(key(&tree), 1007);
        drop(tree);
        let mut tree = leaf(7);
        let start = ALLOCS.load(Ordering::Relaxed);
        for expected in 7..1007 {
            let old = tree.clone();
            tree = change(tree);
            assert_eq!((key(&old), key(&tree)), (expected, expected+1));
        }
        shared += ALLOCS.load(Ordering::Relaxed) - start;
        let weak = Rc::downgrade(&tree);
        tree = change(tree);
        assert_eq!(key(&tree), 1008);
        assert!(weak.upgrade().is_none());
    }
    let reversed = ConsumedNodes_throughBranch(Rc::new(Tree::Node(leaf(3), -10, leaf(17))));
    assert_eq!((key(node(&reversed).0), key(&reversed), key(node(&reversed).2)), (17,10,3));
    let tree = Rc::new(Tree::Node(leaf(3), 10, leaf(17)));
    let address = Rc::as_ptr(&tree);
    let left_address = Rc::as_ptr(node(&tree).0);
    let start = ALLOCS.load(Ordering::Relaxed);
    let changed = ConsumedNodes_throughCallChangingLeft(tree);
    assert_eq!(ALLOCS.load(Ordering::Relaxed)-start, 0);
    assert_eq!(Rc::as_ptr(&changed), address);
    assert_eq!(Rc::as_ptr(node(&changed).0), left_address);
    assert_eq!((key(node(&changed).0), key(&changed)), (4,11));
    let versions = ConsumedNodes_retainThroughCall(leaf(41));
    let Versions::Versions(changed, original) = versions.as_ref();
    assert_eq!((key(changed), key(original)), (42,41));
    let tree = Rc::new(Tree::Node(leaf(3), 10, leaf(17)));
    assert_eq!(key(&ConsumedNodes_returnExisting(tree)),3);
    let order = Rc::new(std::cell::Cell::new(0));
    let observed = order.clone();
    let changed = ConsumedNodes_throughCallback(Func1::Shared(Rc::new(move |child| {
        assert_eq!(Rc::strong_count(&child),1);
        observed.set(observed.get()*100 + key(&child));
        ConsumedNodes_changeRoot(1,child)
    })), Rc::new(Tree::Node(leaf(3),10,leaf(17))));
    assert_eq!(order.get(),317,"Callbacks keep their order and run once per field");
    assert_eq!((key(node(&changed).0),key(node(&changed).2)),(4,18));
    for shared in [false,true] {
        let tree = Rc::new(Tree::Node(leaf(3),10,leaf(17)));
        let old = shared.then(||tree.clone());
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            ConsumedNodes_throughCallback(Func1::Static(|_|panic!("callback unwind")),tree)
        }));
        assert!(result.is_err());
        if let Some(old) = old { assert_eq!((key(node(&old).0),key(&old),key(node(&old).2)),(3,10,17)); }
    }
    let tree = leaf(41);
    let start = ALLOCS.load(Ordering::Relaxed);
    let changed = ConsumedNodes_throughCollision(tree);
    assert_eq!(ALLOCS.load(Ordering::Relaxed)-start,1,"A colliding worker name disables specialization");
    assert_eq!(key(&changed),42);
    assert_eq!(ConsumedNodes_collide__purust_reuse(1),100);
    assert_eq!(unique, 0, "The caller must donate its cell to the returning constructor");
    assert_eq!(shared, 2000);
    (unique, shared)
}

fn main() {
    // Initialize Rust's panic machinery before counting fixture allocations.
    // The callback tests below intentionally unwind through generated code.
    std::panic::set_hook(Box::new(|_| {}));
    drop(std::panic::catch_unwind(|| panic!("warm-up")));
    let allocations = ALLOCS.load(Ordering::Relaxed);
    let frees = FREES.load(Ordering::Relaxed);
    correctness();
    let (unique, shared, path) = allocation_budgets();
    let (call_unique, call_shared) = calls_with_cells();
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - allocations,
        FREES.load(Ordering::Relaxed) - frees, "Every fixture allocation must be freed");
    println!("Reconstruction across 2000 calls: unique={call_unique}, shared={call_shared}");
    println!("Consumed nodes: values, shared children, retained versions and releases checked.");
    println!("Allocations for 1000 updates: unique root={unique}, shared root={shared}, unique two-node path={path}");
}
