use Purs_FieldPermutations::*;
use purust_core::Func1;
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
use std::rc::{Rc, Weak};
use std::sync::atomic::{AtomicUsize, Ordering};

static ALLOCS: AtomicUsize = AtomicUsize::new(0);
static FREES: AtomicUsize = AtomicUsize::new(0);
struct Counter;
unsafe impl GlobalAlloc for Counter {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        FREES.fetch_add(1, Ordering::Relaxed);
        System.dealloc(pointer, layout)
    }
}
#[global_allocator]
static GLOBAL: Counter = Counter;

fn fork(key: i64, left: Rc<Branch>, ready: bool, right: Rc<Branch>) -> Rc<Branch> {
    Rc::new(Branch::Fork(key, left, if ready { Switch::Ready } else { Switch::Stable }, right))
}
fn tip(key: i64) -> Rc<Branch> { Rc::new(Branch::Tip(key)) }
fn parts(node: &Branch) -> (i64, &Rc<Branch>, bool, &Rc<Branch>) {
    let Branch::Fork(key, left, mode, right) = node else { panic!("fork expected") };
    (*key, left, matches!(mode, Switch::Ready), right)
}
fn ready(node: &Branch) -> bool { matches!(node, Branch::Fork(_, _, Switch::Ready, _)) }

// Include constructor tags, keys, enum values and branch order; equal inorder
// keys alone would fail to detect recoloring or permutation mistakes.
fn snapshot(node: &Branch) -> Vec<(u8, i64)> {
    match node {
        Branch::End => vec![(0, 0)],
        Branch::Tip(key) => vec![(1, *key)],
        Branch::Fork(key, left, mode, right) => {
            let mut result = vec![(if matches!(mode, Switch::Ready) { 3 } else { 2 }, *key)];
            result.extend(snapshot(left));
            result.extend(snapshot(right));
            result
        }
    }
}

// This allocates an immutable result and knows nothing about slot permutations.
fn reference_settle(key: i64, left: Rc<Branch>, hot: bool, right: Rc<Branch>, mirror: bool) -> Rc<Branch> {
    if !hot {
        if !mirror && ready(&left) {
            let (y, ll, _, lr) = parts(&left);
            if ready(ll) {
                let (x, a, _, b) = parts(ll);
                return fork(y, fork(x, a.clone(), false, b.clone()), true,
                    fork(key, lr.clone(), false, right));
            }
            if ready(lr) {
                let (middle, b, _, c) = parts(lr);
                return fork(middle, fork(y, ll.clone(), false, b.clone()), true,
                    fork(key, c.clone(), false, right));
            }
        }
        if ready(&right) {
            let (z, rl, _, rr) = parts(&right);
            if !mirror && ready(rl) {
                let (middle, b, _, c) = parts(rl);
                return fork(middle, fork(key, left, false, b.clone()), true,
                    fork(z, c.clone(), false, rr.clone()));
            }
            if ready(rr) {
                let (upper, c, _, d) = parts(rr);
                return fork(z, fork(key, left, false, rl.clone()), true,
                    fork(upper, c.clone(), false, d.clone()));
            }
        }
    }
    fork(key, left, hot, right)
}
fn reference_advance(node: &Branch, rightward: bool, mirror: bool) -> Rc<Branch> {
    match node {
        Branch::End => Rc::new(Branch::End),
        Branch::Tip(key) => tip(*key),
        Branch::Fork(key, left, mode, right) => {
            let increment = |child: &Branch| match child {
                Branch::Fork(key, left, _, right) => fork(key + 1, left.clone(), true, right.clone()),
                Branch::Tip(key) => tip(*key),
                Branch::End => Rc::new(Branch::End),
            };
            let (left, right) = if rightward { (left.clone(), increment(right)) }
                else { (increment(left), right.clone()) };
            reference_settle(*key, left, matches!(mode, Switch::Ready), right, mirror)
        }
    }
}

struct Shape {
    tree: Rc<Branch>,
    old: [Option<Rc<Branch>>; 3],
    weak: [Option<Weak<Branch>>; 3],
    addresses: [*const Branch; 3],
    originals: [Vec<(u8, i64)>; 3],
}
fn shape(side: usize, mask: usize) -> Shape {
    let [a, b, c, d] = [tip(11), tip(23), tip(47), tip(89)];
    let grand = match side {
        0 => fork(17, a, true, b),
        1 | 2 => fork(31, b, true, c),
        _ => fork(61, c, true, d),
    };
    let grand_address = Rc::as_ptr(&grand);
    let grand_snapshot = snapshot(&grand);
    let old_grand = (mask & 16 != 0).then(|| grand.clone());
    let weak_grand = (mask & 32 != 0).then(|| Rc::downgrade(&grand));
    // Fresh leaves keep the setup straightforward and deliberately unequal.
    let child = match side {
        0 => fork(31, grand, false, tip(47)),
        1 => fork(17, tip(11), false, grand),
        2 => fork(61, grand, false, tip(89)),
        _ => fork(31, tip(23), false, grand),
    };
    let child_address = Rc::as_ptr(&child);
    let child_snapshot = snapshot(&child);
    let old_child = (mask & 4 != 0).then(|| child.clone());
    let weak_child = (mask & 8 != 0).then(|| Rc::downgrade(&child));
    let tree = match side {
        0 | 1 => fork(61, child, false, tip(89)),
        _ => fork(17, tip(11), false, child),
    };
    let root_address = Rc::as_ptr(&tree);
    let root_snapshot = snapshot(&tree);
    let old_root = (mask & 1 != 0).then(|| tree.clone());
    let weak_root = (mask & 2 != 0).then(|| Rc::downgrade(&tree));
    Shape { tree, old: [old_root, old_child, old_grand], weak: [weak_root, weak_child, weak_grand],
        addresses: [root_address, child_address, grand_address],
        originals: [root_snapshot, child_snapshot, grand_snapshot] }
}

fn sharing_matrix() -> usize {
    let mut cases = 0;
    for (side, mirror) in [(0, false), (1, false), (2, false), (3, false), (3, true)] {
        for mask in 0..64 {
            let Shape { tree, old, weak, addresses, originals } = shape(side, mask);
            let expected = snapshot(&reference_advance(&tree, side >= 2, mirror));
            let before = ALLOCS.load(Ordering::Relaxed);
            let changed = if mirror { FieldPermutations_advanceMirror(1, tree) }
                else if side >= 2 { FieldPermutations_advanceRight(1, tree) }
                else { FieldPermutations_advanceLeft(1, tree) };
            let allocations = ALLOCS.load(Ordering::Relaxed) - before;
            assert_eq!(snapshot(&changed), expected, "side={side}, mirror={mirror}, mask={mask}");
            if mask == 0 && (side == 0 || mirror) {
                let (_, left, _, right) = parts(&changed);
                let actual = [Rc::as_ptr(&changed), Rc::as_ptr(left), Rc::as_ptr(right)];
                assert_eq!(actual[0], addresses[0], "Keep the unique root cell");
                for address in addresses { assert!(actual.contains(&address), "Keep all three cells"); }
                assert_eq!(allocations, 0, "The proven unique permutation allocates no cells");
            }
            for index in 0..3 {
                if let Some(ref retained) = old[index] { assert_eq!(snapshot(retained), originals[index]); }
                if let Some(ref observer) = weak[index] {
                    if let Some(retained) = observer.upgrade() { assert_eq!(snapshot(&retained), originals[index]); }
                }
            }
            drop(changed);
            for index in 0..3 {
                if let Some(ref retained) = old[index] { assert_eq!(snapshot(retained), originals[index]); }
            }
            drop(old);
            for observer in weak.into_iter().flatten() { assert!(observer.upgrade().is_none()); }
            cases += 1;
        }
    }
    cases
}

fn guards_and_fallbacks() {
    let candidates = || [
        Rc::new(Branch::End), tip(123),
        fork(10, Rc::new(Branch::End), false, tip(90)),
        fork(10, tip(20), false, tip(90)),
        fork(10, fork(20, tip(30), false, tip(40)), false, tip(90)),
        fork(10, fork(20, fork(30, tip(40), false, tip(50)), false, tip(60)), false, tip(90)),
        fork(10, fork(20, fork(30, tip(40), true, tip(50)), false, tip(60)), true, tip(90)),
        // Two matching child orientations: the first source alternative wins.
        fork(10, fork(20, fork(30, tip(40), true, tip(50)), false,
            fork(60, tip(70), true, tip(80))), false, tip(90)),
    ];
    for rightward in [false, true] {
        for shared in [false, true] {
            for tree in candidates() {
                let original = snapshot(&tree);
                let expected = snapshot(&reference_advance(&tree, rightward, false));
                let old = shared.then(|| tree.clone());
                let changed = if rightward { FieldPermutations_advanceRight(1, tree) }
                    else { FieldPermutations_advanceLeft(1, tree) };
                assert_eq!(snapshot(&changed), expected);
                if let Some(old) = old { assert_eq!(snapshot(&old), original); }
            }
        }
    }
    let input = shape(0, 1);
    let normal = reference_advance(&input.tree, false, false);
    let (key, left, hot, right) = parts(&normal);
    let (right_key, repeated, right_hot, _) = parts(right);
    let expected_duplicate = fork(key, left.clone(), hot,
        fork(right_key, repeated.clone(), right_hot, repeated.clone()));
    let duplicate = FieldPermutations_advanceDuplicate(1, input.tree);
    assert_eq!(snapshot(&duplicate), snapshot(&expected_duplicate));
    assert_eq!(snapshot(input.old[0].as_ref().unwrap()), input.originals[0]);

    let input = shape(0, 1);
    let normal = reference_advance(&input.tree, false, false);
    let (key, left, hot, right) = parts(&normal);
    let expected_calculated = fork(key + 1, left.clone(), hot, right.clone());
    let calculated = FieldPermutations_advanceCalculated(1, input.tree);
    assert_eq!(snapshot(&calculated), snapshot(&expected_calculated));
    assert_eq!(snapshot(input.old[0].as_ref().unwrap()), input.originals[0]);
}

fn callbacks_and_unwind() {
    for shared in [false, true] {
        let input = shape(0, usize::from(shared));
        let expected = snapshot(&reference_advance(&input.tree, false, false));
        let calls = Rc::new(Cell::new(0));
        let observed = calls.clone();
        let changed = FieldPermutations_throughCallback(Func1::Shared(Rc::new(move |child| {
            observed.set(observed.get() + 1);
            FieldPermutations_advanceLeft(0, child)
        })), input.tree);
        assert_eq!(calls.get(), 1);
        assert_eq!(snapshot(&changed), expected);
        if let Some(ref old) = input.old[0] { assert_eq!(snapshot(old), input.originals[0]); }
    }
    let input = shape(0, 1);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        FieldPermutations_throughCallback(Func1::Static(|_| panic!("permutation callback")), input.tree)));
    assert!(result.is_err());
    assert_eq!(snapshot(input.old[0].as_ref().unwrap()), input.originals[0]);
}

fn main() {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if !matches!(info.payload().downcast_ref::<&str>(), Some(&"warm-up" | &"permutation callback")) {
            previous_hook(info);
        }
    }));
    drop(std::panic::catch_unwind(|| panic!("warm-up")));
    drop(FieldPermutations_advanceLeft(0, Rc::new(Branch::End)));
    drop(FieldPermutations_advanceRight(0, Rc::new(Branch::End)));
    drop(FieldPermutations_advanceMirror(0, Rc::new(Branch::End)));
    let before = (ALLOCS.load(Ordering::Relaxed), FREES.load(Ordering::Relaxed));
    let cases = sharing_matrix();
    guards_and_fallbacks();
    callbacks_and_unwind();
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before.0,
        FREES.load(Ordering::Relaxed) - before.1, "All fixture allocations must be released");
    println!("Field permutations: {cases} sharing cases; independent layout, first-arm priority, guards, original versions, weak observers, addresses, callbacks, unwind and releases checked.");
}
