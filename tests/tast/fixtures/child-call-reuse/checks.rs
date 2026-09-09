use Purs_ChildCallReuse::*;
use purust_core::Func1;
use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;
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
    Rc::new(Tree::Fork(Flag::Keep, Rc::new(Tree::Tip), key, Rc::new(Tree::Tip)))
}
fn parts(tree: &Tree) -> (&Flag, &Rc<Tree>, i64, &Rc<Tree>) {
    let Tree::Fork(flag, left, key, right) = tree else { panic!("fork expected") };
    (flag, left, *key, right)
}
fn keys(tree: &Tree) -> (i64, i64, i64) {
    let (_, left, key, right) = parts(tree);
    (parts(left).2, key, parts(right).2)
}
fn root(flag: Flag) -> Rc<Tree> {
    Rc::new(Tree::Fork(flag, leaf(3), 10, leaf(17)))
}

fn sharing_matrix() {
    for turn in [false, true] {
        for rightward in [false, true] {
            for mask in 0..32 {
                let shared_root = mask & 1 != 0;
                let weak_root = mask & 2 != 0;
                let shared_child = mask & 4 != 0;
                let weak_child = mask & 8 != 0;
                let alias_children = mask & 16 != 0;
                let child = leaf(3);
                let old_child = shared_child.then(|| child.clone());
                let child_weak = weak_child.then(|| Rc::downgrade(&child));
                let child_address = Rc::as_ptr(&child);
                let sibling = if alias_children { child.clone() } else { leaf(17) };
                let sibling_key = parts(&sibling).2;
                let sibling_address = Rc::as_ptr(&sibling);
                let (left, right) = if rightward { (sibling, child) } else { (child, sibling) };
                let tree = Rc::new(Tree::Fork(if turn { Flag::Turn } else { Flag::Keep }, left, 10, right));
                let root_address = Rc::as_ptr(&tree);
                let original_keys = keys(&tree);
                let old = shared_root.then(|| tree.clone());
                let root_weak = weak_root.then(|| Rc::downgrade(&tree));
                let changed = if rightward { ChildCallReuse_walkRight(1, tree) }
                    else { ChildCallReuse_walkLeft(1, tree) };
                let (flag, left, key, right) = parts(&changed);
                assert_eq!(matches!(flag, Flag::Turn), turn);
                assert_eq!(key, if turn { 11 } else { 10 });
                let (updated, untouched) = if rightward != turn { (right, left) } else { (left, right) };
                assert_eq!((parts(updated).2, parts(untouched).2), (4, sibling_key));
                assert_eq!(Rc::as_ptr(untouched), sibling_address, "Preserve the sibling cell");
                if !shared_root && !weak_root && !turn {
                    assert_eq!(Rc::as_ptr(&changed), root_address, "Reuse the unique parent cell");
                }
                if !shared_root && !weak_root && !shared_child && !weak_child && !alias_children {
                    assert_eq!(Rc::as_ptr(updated), child_address, "Move the unique child into its call");
                }
                if let Some(ref old) = old { assert_eq!(keys(old), original_keys); }
                if let Some(ref old_child) = old_child { assert_eq!(parts(old_child).2, 3); }
                if let Some(ref weak) = root_weak {
                    assert_eq!(weak.upgrade().is_some(), shared_root);
                    if let Some(original) = weak.upgrade() { assert_eq!(keys(&original), original_keys); }
                }
                if let Some(ref weak) = child_weak {
                    assert_eq!(weak.upgrade().is_some(), shared_root || shared_child || alias_children);
                    if let Some(original) = weak.upgrade() { assert_eq!(parts(&original).2, 3); }
                }
                drop(changed);
                if let Some(ref old) = old { assert_eq!(keys(old), original_keys); }
                drop(old);
                drop(old_child);
                if let Some(weak) = root_weak { assert!(weak.upgrade().is_none()); }
                if let Some(weak) = child_weak { assert!(weak.upgrade().is_none()); }
            }
        }
    }
}

fn repeated_and_fallbacks() {
    let mut tree = root(Flag::Keep);
    let address = Rc::as_ptr(&tree);
    let child_address = Rc::as_ptr(parts(&tree).1);
    let before = ALLOCS.load(Ordering::Relaxed);
    for _ in 0..1000 { tree = ChildCallReuse_walkLeft(1, tree); }
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before, 0, "The unique path allocates no cells");
    assert_eq!(keys(&tree), (1003, 10, 17));
    assert_eq!(Rc::as_ptr(&tree), address);
    assert_eq!(Rc::as_ptr(parts(&tree).1), child_address);
    drop(tree);

    let versions = ChildCallReuse_retain(1, root(Flag::Keep));
    let Versions::Versions(changed, old) = versions.as_ref();
    assert_eq!(keys(changed), (4, 10, 17));
    assert_eq!(keys(old), (3, 10, 17));
    drop(versions);
    assert_eq!(keys(&ChildCallReuse_bothChildren(root(Flag::Keep))), (4, 10, 18));
    assert_eq!(keys(&ChildCallReuse_aliasChild(root(Flag::Keep))), (4, 10, 3));
    // The helper's nontrivial branch remains active on both traversal sides.
    assert_eq!(keys(&ChildCallReuse_bothChildren(root(Flag::Turn))), (18, 11, 4));
    assert_eq!(keys(&ChildCallReuse_aliasChild(root(Flag::Turn))), (3, 11, 4));
    assert_eq!(keys(&ChildCallReuse_walkChecked(1, root(Flag::Keep))), (4, 10, 17));
    assert_eq!(keys(&ChildCallReuse_walkChecked(1, root(Flag::Turn))), (17, 11, 4));
}

fn callbacks_and_unwind() {
    for turn in [false, true] {
        for shared in [false, true] {
            let tree = root(if turn { Flag::Turn } else { Flag::Keep });
            let old = shared.then(|| tree.clone());
            let calls = Rc::new(Cell::new(0));
            let observed = calls.clone();
            let changed = ChildCallReuse_throughCallback(Func1::Shared(Rc::new(move |child| {
                observed.set(observed.get() + 1);
                assert_eq!(parts(&child).2, 3);
                ChildCallReuse_walkLeft(0, child)
            })), tree);
            assert_eq!(calls.get(), 1);
            assert_eq!(keys(&changed), if turn { (17, 11, 4) } else { (4, 10, 17) });
            if let Some(old) = old { assert_eq!(keys(&old), (3, 10, 17)); }
        }
        for fail_at in [0, 1, 2] {
            let tree = root(if turn { Flag::Turn } else { Flag::Keep });
            let old = tree.clone();
            let order = Rc::new(Cell::new(0));
            let child_order = order.clone();
            let key_order = order.clone();
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                ChildCallReuse_ordered(
                    Func1::Shared(Rc::new(move |child| {
                        assert_eq!(child_order.replace(1), 0);
                        if fail_at == 1 { panic!("first argument callback"); }
                        ChildCallReuse_walkLeft(0, child)
                    })),
                    Func1::Shared(Rc::new(move |key| {
                        assert_eq!(key_order.replace(2), 1);
                        if fail_at == 2 { panic!("second argument callback"); }
                        key + 2
                    })), tree)
            }));
            assert_eq!(order.get(), if fail_at == 1 { 1 } else { 2 });
            if fail_at == 0 {
                assert_eq!(keys(&result.unwrap()), if turn { (17, 13, 4) } else { (4, 12, 17) });
            } else { assert!(result.is_err()); }
            assert_eq!(keys(&old), (3, 10, 17), "Unwinding preserves retained roots");
        }
        for shared in [false, true] {
            for weakly_shared in [false, true] {
                let tree = root(if turn { Flag::Turn } else { Flag::Keep });
                let old = shared.then(|| tree.clone());
                let weak = weakly_shared.then(|| Rc::downgrade(&tree));
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    ChildCallReuse_throughCallback(Func1::Static(|_| panic!("child callback")), tree)
                }));
                assert!(result.is_err());
                if let Some(ref old) = old { assert_eq!(keys(old), (3, 10, 17)); }
                if let Some(ref weak) = weak { assert_eq!(weak.upgrade().is_some(), shared); }
                drop(old);
                if let Some(weak) = weak { assert!(weak.upgrade().is_none()); }

                let tree = Rc::new(Tree::Fork(if turn { Flag::Turn } else { Flag::Keep }, leaf(-99), 10, leaf(17)));
                let old = shared.then(|| tree.clone());
                let weak = weakly_shared.then(|| Rc::downgrade(&tree));
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    ChildCallReuse_walkChecked(1, tree)
                }));
                assert!(result.is_err());
                if let Some(ref old) = old { assert_eq!(keys(old), (-99, 10, 17)); }
                if let Some(ref weak) = weak { assert_eq!(weak.upgrade().is_some(), shared); }
                drop(old);
                if let Some(weak) = weak { assert!(weak.upgrade().is_none()); }
            }
        }
    }
}

fn main() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if !matches!(info.payload().downcast_ref::<&str>(),
            Some(&"warm-up" | &"first argument callback" | &"second argument callback" | &"child callback" | &"foreign child call")) {
            default_hook(info);
        }
    }));
    drop(std::panic::catch_unwind(|| panic!("warm-up")));
    // Initialize the generated shared nullary before measuring complete release.
    drop(ChildCallReuse_walkLeft(0, Rc::new(Tree::Tip)));
    drop(ChildCallReuse_walkRight(0, Rc::new(Tree::Tip)));
    let before = (ALLOCS.load(Ordering::Relaxed), FREES.load(Ordering::Relaxed));
    sharing_matrix();
    repeated_and_fallbacks();
    callbacks_and_unwind();
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before.0,
        FREES.load(Ordering::Relaxed) - before.1,
        "All fixture allocations are released, including during callback unwinding");
    println!("Child calls: 128 root/child sharing cases, both sides, helper fallback, persistence, order and unwind checked.");
}
