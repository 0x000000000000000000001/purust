use Purs_PostCallChildReuse::*;
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

fn leaf(mode: Mode, key: i64) -> Rc<Node> {
    Rc::new(Node::Branch(mode, Rc::new(Node::Vacant), key, Rc::new(Node::Vacant)))
}
fn parts(node: &Node) -> (&Mode, &Rc<Node>, i64, &Rc<Node>) {
    let Node::Branch(mode, left, key, right) = node else { panic!("branch expected") };
    (mode, left, *key, right)
}
fn marked(node: &Node) -> bool { matches!(node, Node::Branch(Mode::Marked, ..)) }
fn snapshot(node: &Node) -> Vec<(i64, i64)> {
    match node {
        Node::Vacant => vec![(-1, 0)],
        Node::Branch(mode, left, key, right) => {
            let mut result = vec![(i64::from(matches!(mode, Mode::Marked)), *key)];
            result.extend(snapshot(left));
            result.extend(snapshot(right));
            result
        }
    }
}

// Immutable reference: classify the actual computed child and preserve rule order.
fn reference_join(mode: Mode, left: Rc<Node>, key: i64, right: Rc<Node>) -> Rc<Node> {
    let left_case = matches!(left.as_ref(), Node::Branch(Mode::Marked, child, _, _) if marked(child));
    let right_case = matches!(right.as_ref(), Node::Branch(Mode::Marked, _, _, child) if marked(child));
    if left_case { Rc::new(Node::Branch(mode, right, key + 100, left)) }
    else if right_case { Rc::new(Node::Branch(mode, right, key + 200, left)) }
    else { Rc::new(Node::Branch(mode, left, key, right)) }
}
fn reference_advance(depth: i64, rightward: bool, node: &Node) -> Rc<Node> {
    let Node::Branch(mode, left, key, right) = node else { return Rc::new(Node::Vacant) };
    if depth == 0 {
        let mode = if matches!(mode, Mode::Marked) { Mode::Calm } else { Mode::Marked };
        Rc::new(Node::Branch(mode, left.clone(), key + 1, right.clone()))
    } else if rightward {
        reference_join(mode.clone(), left.clone(), *key, reference_advance(depth - 1, rightward, right))
    } else {
        reference_join(mode.clone(), reference_advance(depth - 1, rightward, left), *key, right.clone())
    }
}

fn child_shape(case: usize, rightward: bool) -> Rc<Node> {
    if case == 4 { return Rc::new(Node::Vacant) }
    let mode = if case == 1 { Mode::Marked } else { Mode::Calm };
    let nested = match case {
        2 => Rc::new(Node::Vacant),
        3 => leaf(Mode::Calm, 8),
        _ => leaf(Mode::Marked, 8),
    };
    let other = leaf(Mode::Calm, 12);
    let (left, right) = if rightward { (other, nested) } else { (nested, other) };
    Rc::new(Node::Branch(mode, left, 20, right))
}

fn sharing_matrix() -> (usize, usize) {
    let mut simple = 0;
    let mut complex = 0;
    for rightward in [false, true] {
        // 0: guard becomes true; 1: guard becomes false; 2/4: guarded projection
        // stops at Vacant; 3: nested tag differs despite the outer tag matching.
        for case in 0..5 {
            for mask in 0..32 {
                let shared_root = mask & 1 != 0;
                let weak_root = mask & 2 != 0;
                let shared_child = mask & 4 != 0;
                let weak_child = mask & 8 != 0;
                let alias_children = mask & 16 != 0;
                let child = child_shape(case, rightward);
                let child_address = Rc::as_ptr(&child);
                let original_child = snapshot(&child);
                let old_child = shared_child.then(|| child.clone());
                let child_weak = weak_child.then(|| Rc::downgrade(&child));
                let sibling = if alias_children { child.clone() } else { leaf(Mode::Calm, 90) };
                let sibling_address = Rc::as_ptr(&sibling);
                let (left, right) = if rightward { (sibling, child) } else { (child, sibling) };
                let node = Rc::new(Node::Branch(Mode::Calm, left, 50, right));
                let address = Rc::as_ptr(&node);
                let original = snapshot(&node);
                let expected = snapshot(&reference_advance(1, rightward, &node));
                let old = shared_root.then(|| node.clone());
                let root_weak = weak_root.then(|| Rc::downgrade(&node));
                let changed = if rightward { PostCallChildReuse_advanceRight(1, node) }
                    else { PostCallChildReuse_advanceLeft(1, node) };
                assert_eq!(snapshot(&changed), expected, "direction={rightward}, case={case}, mask={mask}");
                let (_, left, key, right) = parts(&changed);
                let swapped = key != 50;
                if swapped { complex += 1; } else { simple += 1; }
                let (updated, untouched) = if rightward != swapped { (right, left) } else { (left, right) };
                assert_eq!(Rc::as_ptr(untouched), sibling_address);
                if case != 4 {
                    assert_eq!(parts(updated).2, 21, "Evaluate the child call exactly once, including fallback");
                    assert_eq!(marked(updated), case != 1, "Inspect the returned mode, not the input mode");
                }
                if !shared_root && !weak_root && !swapped {
                    assert_eq!(Rc::as_ptr(&changed), address, "Retain the unique parent on the simple route");
                }
                if case != 4 && !shared_root && !weak_root && !shared_child && !weak_child && !alias_children {
                    assert_eq!(Rc::as_ptr(updated), child_address, "Consume the unique child in its call");
                }
                if let Some(ref old) = old { assert_eq!(snapshot(old), original); }
                if let Some(ref old_child) = old_child { assert_eq!(snapshot(old_child), original_child); }
                if let Some(ref weak) = root_weak {
                    assert_eq!(weak.upgrade().is_some(), shared_root);
                    if let Some(original_root) = weak.upgrade() { assert_eq!(snapshot(&original_root), original); }
                }
                if let Some(ref weak) = child_weak {
                    if let Some(original_node) = weak.upgrade() { assert_eq!(snapshot(&original_node), original_child); }
                }
                drop(changed);
                if let Some(ref old) = old { assert_eq!(snapshot(old), original); }
                drop(old); drop(old_child);
                if let Some(weak) = root_weak { assert!(weak.upgrade().is_none()); }
                if let Some(weak) = child_weak { assert!(weak.upgrade().is_none()); }
            }
        }
    }
    assert!(simple > 0 && complex > 0);
    (simple, complex)
}

fn recursive_and_retained() {
    for rightward in [false, true] {
        let mut node = child_shape(0, rightward);
        for key in [30, 40, 50] {
            node = if rightward { Rc::new(Node::Branch(Mode::Calm, leaf(Mode::Calm, key + 7), key, node)) }
                else { Rc::new(Node::Branch(Mode::Calm, node, key, leaf(Mode::Calm, key + 7))) };
        }
        for depth in 0..5 {
            let expected = snapshot(&reference_advance(depth, rightward, &node));
            let original = snapshot(&node);
            let changed = if rightward { PostCallChildReuse_advanceRight(depth, node.clone()) }
                else { PostCallChildReuse_advanceLeft(depth, node.clone()) };
            assert_eq!(snapshot(&changed), expected);
            assert_eq!(snapshot(&node), original);
        }
        let expected = snapshot(&reference_advance(1, false, &node));
        let original = snapshot(&node);
        let versions = PostCallChildReuse_retain(1, node);
        let Versions::Versions(changed, old) = versions.as_ref();
        assert_eq!(snapshot(changed), expected);
        assert_eq!(snapshot(old), original);
    }
}

fn callbacks_and_fallbacks() {
    for shared in [false, true] {
        for weakly_shared in [false, true] {
            let node = Rc::new(Node::Branch(Mode::Calm, child_shape(0, false), 50, leaf(Mode::Calm, 90)));
            let original = snapshot(&node);
            let expected = snapshot(&reference_advance(1, false, &node));
            let old = shared.then(|| node.clone());
            let weak = weakly_shared.then(|| Rc::downgrade(&node));
            let count = Rc::new(Cell::new(0));
            let observed = count.clone();
            let changed = PostCallChildReuse_throughCallback(Func1::Shared(Rc::new(move |child| {
                observed.set(observed.get() + 1);
                PostCallChildReuse_advanceLeft(0, child)
            })), node);
            assert_eq!(count.get(), 1);
            assert_eq!(snapshot(&changed), expected);
            if let Some(ref old) = old { assert_eq!(snapshot(old), original); }
            if let Some(ref weak) = weak { assert_eq!(weak.upgrade().is_some(), shared); }
            drop(changed); drop(old);
            if let Some(weak) = weak { assert!(weak.upgrade().is_none()); }

            let node = Rc::new(Node::Branch(Mode::Calm, child_shape(0, false), 50, leaf(Mode::Calm, 90)));
            let original = snapshot(&node);
            let old = shared.then(|| node.clone());
            let weak = weakly_shared.then(|| Rc::downgrade(&node));
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                PostCallChildReuse_throughCallback(Func1::Static(|_| panic!("external callback")), node)
            }));
            assert!(result.is_err());
            if let Some(ref old) = old { assert_eq!(snapshot(old), original); }
            if let Some(ref weak) = weak { assert_eq!(weak.upgrade().is_some(), shared); }
            drop(old);
            if let Some(weak) = weak { assert!(weak.upgrade().is_none()); }
        }
    }
    let left = child_shape(0, false);
    let right = child_shape(0, true);
    let expected = snapshot(&reference_join(Mode::Calm,
        reference_advance(0, false, &left), 50, reference_advance(0, true, &right)));
    let changed = PostCallChildReuse_bothChildren(Rc::new(Node::Branch(Mode::Calm, left, 50, right)));
    assert_eq!(snapshot(&changed), expected);
}

fn main() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if !matches!(info.payload().downcast_ref::<&str>(), Some(&"warm-up" | &"external callback")) {
            default_hook(info);
        }
    }));
    drop(std::panic::catch_unwind(|| panic!("warm-up")));
    drop(PostCallChildReuse_advanceLeft(0, Rc::new(Node::Vacant)));
    drop(PostCallChildReuse_advanceRight(0, Rc::new(Node::Vacant)));
    let before = (ALLOCS.load(Ordering::Relaxed), FREES.load(Ordering::Relaxed));
    let (simple, complex) = sharing_matrix();
    recursive_and_retained();
    callbacks_and_fallbacks();
    assert_eq!(ALLOCS.load(Ordering::Relaxed) - before.0,
        FREES.load(Ordering::Relaxed) - before.1, "Every fixture allocation must be released");
    println!("Post-call child guards: 320 sharing cases ({simple} simple, {complex} complex), returned tags, one call, recursion, persistence and unwind checked.");
}
