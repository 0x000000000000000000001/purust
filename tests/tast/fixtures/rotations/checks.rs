use std::alloc::{GlobalAlloc, Layout, System};
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_Rotations::*;
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
fn leaf(k: i64) -> Rc<Tree> {
    Rc::new(Tree::Node(
        Color::Black,
        Rc::new(Tree::Empty),
        k,
        Rc::new(Tree::Empty),
    ))
}
fn parts(tree: &Tree) -> (&Rc<Tree>, i64, &Rc<Tree>) {
    if let Tree::Node(_, l, k, r) = tree {
        (l, *k, r)
    } else {
        panic!("node expected")
    }
}
fn keys(tree: &Tree) -> Vec<i64> {
    match tree {
        Tree::Empty => vec![],
        Tree::Node(_, l, k, r) => {
            let mut v = keys(l);
            v.push(*k);
            v.extend(keys(r));
            v
        }
    }
}

fn red(tree: &Tree) -> bool {
    matches!(tree, Tree::Node(Color::Red, ..))
}
fn shape(
    side: usize,
    mode: usize,
) -> (
    Rc<Tree>,
    i64,
    Rc<Tree>,
    Option<Rc<Tree>>,
    Option<std::rc::Weak<Tree>>,
    [*const Tree; 2],
    Vec<i64>,
) {
    let [a, b, c, d] = [leaf(1), leaf(3), leaf(5), leaf(7)];
    let (left, key, right, inner_address, retained_inner, weak_inner) = match side {
        0 => {
            let inner = Rc::new(Tree::Node(Color::Red, a, 2, b));
            let addr = Rc::as_ptr(&inner);
            let old = (mode == 2).then(|| inner.clone());
            let weak = (mode == 4).then(|| Rc::downgrade(&inner));
            (
                Rc::new(Tree::Node(Color::Red, inner, 4, c)),
                6,
                d,
                addr,
                old,
                weak,
            )
        }
        1 => {
            let inner = Rc::new(Tree::Node(Color::Red, b, 4, c));
            let addr = Rc::as_ptr(&inner);
            let old = (mode == 2).then(|| inner.clone());
            let weak = (mode == 4).then(|| Rc::downgrade(&inner));
            (
                Rc::new(Tree::Node(Color::Red, a, 2, inner)),
                6,
                d,
                addr,
                old,
                weak,
            )
        }
        2 => {
            let inner = Rc::new(Tree::Node(Color::Red, b, 4, c));
            let addr = Rc::as_ptr(&inner);
            let old = (mode == 2).then(|| inner.clone());
            let weak = (mode == 4).then(|| Rc::downgrade(&inner));
            (
                a,
                2,
                Rc::new(Tree::Node(Color::Red, inner, 6, d)),
                addr,
                old,
                weak,
            )
        }
        _ => {
            let inner = Rc::new(Tree::Node(Color::Red, c, 6, d));
            let addr = Rc::as_ptr(&inner);
            let old = (mode == 2).then(|| inner.clone());
            let weak = (mode == 4).then(|| Rc::downgrade(&inner));
            (
                a,
                2,
                Rc::new(Tree::Node(Color::Red, b, 4, inner)),
                addr,
                old,
                weak,
            )
        }
    };
    let outer = if side < 2 { &left } else { &right };
    let addresses = [Rc::as_ptr(outer), inner_address];
    let old = if mode == 1 {
        Some(outer.clone())
    } else {
        retained_inner
    };
    let weak = if mode == 3 {
        Some(Rc::downgrade(outer))
    } else {
        weak_inner
    };
    let old_keys = old.as_ref().map(|tree| keys(tree)).unwrap_or_default();
    (left, key, right, old, weak, addresses, old_keys)
}
fn rotations() -> [[usize; 5]; 4] {
    let mut counts = [[0; 5]; 4];
    for side in 0..4 {
        for mode in 0..5 {
            let (left, key, right, old, weak, addresses, old_keys) = shape(side, mode);
            let before = ALLOCS.load(Ordering::Relaxed);
            let changed = Rotations_balance(Color::Black, left, key, right);
            let count = ALLOCS.load(Ordering::Relaxed) - before;
            assert_eq!(keys(&changed), vec![1, 2, 3, 4, 5, 6, 7]);
            let (l, k, r) = parts(&changed);
            assert_eq!((parts(l).1, k, parts(r).1), (2, 4, 6));
            assert!(red(&changed));
            assert!(!red(l));
            assert!(!red(r));
            assert_eq!(count, [1, 3, 2, 3, 2][mode], "side={side}, mode={mode}");
            if mode == 0 {
                let actual = [Rc::as_ptr(l), Rc::as_ptr(r)];
                for address in addresses {
                    assert!(
                        actual.contains(&address),
                        "Both old cells are reused as children"
                    );
                }
            }
            if let Some(old) = old {
                assert_eq!(keys(&old), old_keys);
                drop(changed);
                assert_eq!(keys(&old), old_keys);
            }
            if let Some(weak) = weak {
                assert!(
                    weak.upgrade().is_none(),
                    "A weak alias must not observe rewritten contents"
                );
            }
            counts[side][mode] = count;
        }
    }
    counts
}
fn main() {
    let start = (
        ALLOCS.load(Ordering::Relaxed),
        FREES.load(Ordering::Relaxed),
    );
    let counts = rotations();
    for shared in [false, true] {
        let left = Rc::new(Tree::Node(Color::Red, leaf(1), 2, leaf(3)));
        let old = shared.then(|| left.clone());
        let right = leaf(5);
        let before = ALLOCS.load(Ordering::Relaxed);
        let changed = Rotations_rotateRight(left, 4, right);
        assert_eq!(
            ALLOCS.load(Ordering::Relaxed) - before,
            if shared { 2 } else { 1 }
        );
        assert_eq!(keys(&changed), vec![1, 2, 3, 4, 5]);
        if let Some(old) = old {
            assert_eq!(keys(&old), vec![1, 2, 3]);
        }
    }
    // No matching rotation: keep the original children and color.
    let left = leaf(1);
    let right = leaf(3);
    let addresses = [Rc::as_ptr(&left), Rc::as_ptr(&right)];
    let changed = Rotations_balance(Color::Red, left, 2, right);
    assert_eq!(keys(&changed), vec![1, 2, 3]);
    assert!(red(&changed));
    assert_eq!(
        [Rc::as_ptr(parts(&changed).0), Rc::as_ptr(parts(&changed).2)],
        addresses
    );
    drop(changed);
    assert_eq!(
        ALLOCS.load(Ordering::Relaxed) - start.0,
        FREES.load(Ordering::Relaxed) - start.1,
        "All allocations are freed, including shared/weak cases"
    );
    println!("Four rotations: [unique, shared root, shared child, weak root, weak child] allocations = {counts:?}");
    println!("Keys, colors, reused addresses, persistence and complete releases checked.");
}
