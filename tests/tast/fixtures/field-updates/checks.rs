use Purs_FieldUpdates::*;
use std::rc::Rc;
use purust_core::Func1;

fn root() -> Rc<Tree> {
    let child = Rc::new(Tree::Empty);
    Rc::new(Tree::Branch(Shade::Red, child.clone(), 7, child))
}
fn fields(tree: &Tree) -> (&Shade, &Rc<Tree>, i64, &Rc<Tree>) {
    let Tree::Branch(shade, left, key, right) = tree else { panic!("branch") };
    (shade, left, *key, right)
}
fn main() {
    for change in [FieldUpdates_blacken, |t| FieldUpdates_paint(Shade::Black, t)] {
        for shared in [false, true] {
            for weakly_shared in [false, true] {
                let tree = root();
                let address = Rc::as_ptr(&tree);
                let old = shared.then(|| tree.clone());
                let weak = weakly_shared.then(|| Rc::downgrade(&tree));
                let child = Rc::downgrade(fields(&tree).1);
                let changed = change(tree);
                let (shade, left, key, right) = fields(&changed);
                assert!(matches!(shade, Shade::Black)); assert_eq!(key, 7);
                assert!(Rc::ptr_eq(left, right));
                assert!(Rc::ptr_eq(left, &child.upgrade().unwrap()));
                if !shared && !weakly_shared { assert_eq!(address, Rc::as_ptr(&changed)); }
                if let std::option::Option::Some(ref old) = old {
                    assert!(matches!(fields(old).0, Shade::Red));
                    assert_ne!(address, Rc::as_ptr(&changed));
                }
                if let std::option::Option::Some(weak) = weak { assert_eq!(weak.upgrade().is_some(), shared); }
                drop(changed); drop(old);
                assert!(child.upgrade().is_none());
            }
        }
    }
    let tree = root(); let address = Rc::as_ptr(&tree);
    let changed = FieldUpdates_setKey(99, tree);
    assert_eq!(fields(&changed).2, 99); assert_eq!(address, Rc::as_ptr(&changed));
    let solid = Rc::new(Solid::Solid(Shade::Red, 11)); let address = Rc::as_ptr(&solid);
    let solid = FieldUpdates_paintSolid(Shade::Black, solid);
    assert!(matches!(solid.as_ref(), Solid::Solid(Shade::Black, 11)));
    assert_eq!(address, Rc::as_ptr(&solid));
    let versions = FieldUpdates_retain(Shade::Black, root());
    let Versions::Versions(changed, old) = versions.as_ref();
    assert!(matches!(fields(changed).0, Shade::Black));
    assert!(matches!(fields(old).0, Shade::Red));

    // A callback may observe a retained old root; evaluate it exactly once.
    let old = root(); let captured = old.clone();
    let calls = Rc::new(std::cell::Cell::new(0)); let count = calls.clone();
    let change = Func1::Shared(Rc::new(move |shade| {
        count.set(count.get() + 1);
        assert!(matches!(shade, Shade::Red));
        assert!(matches!(fields(&captured).0, Shade::Red));
        Shade::Black
    }));
    let changed = FieldUpdates_viaCall(change, old.clone());
    assert_eq!(calls.get(), 1);
    assert!(matches!(fields(&changed).0, Shade::Black));
    assert!(matches!(fields(&old).0, Shade::Red));

    let left = root(); let right = root();
    let tree = Rc::new(Tree::Branch(Shade::Red, left.clone(), 3, right.clone()));
    let swapped = FieldUpdates_swapChildren(tree);
    assert!(Rc::ptr_eq(fields(&swapped).1, &right));
    assert!(Rc::ptr_eq(fields(&swapped).3, &left));
    let both = FieldUpdates_both(Shade::Black, 88, root());
    assert!(matches!(fields(&both).0, Shade::Black)); assert_eq!(fields(&both).2, 88);
    let changed = FieldUpdates_replaceChild(left.clone(), root());
    assert!(Rc::ptr_eq(fields(&changed).1, &left));
    let nested = FieldUpdates_nestOriginal(root());
    assert_eq!(fields(fields(&nested).3).2, 7);
    let weak = Rc::downgrade(fields(&nested).3);
    drop(nested); assert!(weak.upgrade().is_none());
    assert!(matches!(FieldUpdates_blacken(Rc::new(Tree::Empty)).as_ref(), Tree::Empty));
    println!("Scalar field updates preserve aliases, weak references, callbacks and retained values.");
}
