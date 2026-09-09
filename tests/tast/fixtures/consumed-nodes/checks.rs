use Purs_ConsumedNodes::*;
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
}

fn allocation_budgets() -> (usize, usize, usize) {
    let iterations = std::hint::black_box(1000);
    let tree = leaf(7);
    assert_eq!(Rc::strong_count(&tree), 1);
    let start = ALLOCS.load(Ordering::Relaxed);
    let tree = ConsumedNodes_repeatRoot(iterations, 1, tree);
    let unique = ALLOCS.load(Ordering::Relaxed) - start;
    assert_eq!(key(&tree), 7 + iterations);
    // These are pre-optimization ceilings, not required allocation counts.
    assert!(unique <= iterations as usize, "Unique root: {unique}");
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
    assert!(path <= 2 * iterations as usize, "Unique path: {path}");
    (unique, shared, path)
}

fn main() {
    let allocations = ALLOCS.load(Ordering::Relaxed);
    let frees = FREES.load(Ordering::Relaxed);
    correctness();
    let (unique, shared, path) = allocation_budgets();
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - allocations,
        FREES.load(Ordering::Relaxed) - frees, "Every fixture allocation must be freed");
    println!("Consumed nodes: values, shared children, retained versions and releases checked.");
    println!("Allocations for 1000 updates: unique root={unique}, shared root={shared}, unique two-node path={path}");
}
