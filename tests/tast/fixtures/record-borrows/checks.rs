use purust_core::*;
use Purs_RecordBorrows::*;
use std::cell::RefCell;
use std::rc::Rc;

fn values(root: &Value) -> [i64; 5] {
    [root.get_seed().unwrap_int(), root.get_middle().get_offset().unwrap_int(),
        root.get_middle().get_leaf().get_tally().unwrap_int(),
        root.get_middle().get_leaf().get_tally_ref().unwrap_int(),
        root.get_middle().get_leaf().get_ref_tally().unwrap_int()]
}
fn root_address(root: &Value) -> usize {
    let Value::Record_middle_seed_title(pointer) = root else { panic!("root") };
    &**pointer as *const _ as usize
}
fn middle_address(root: &Value) -> usize {
    let Value::Record_leaf_offset(pointer) = root.get_middle() else { panic!("middle") };
    &*pointer as *const _ as usize
}
fn leaf_address(root: &Value) -> usize {
    let Value::Record_action_flag_glyph_note_ratio_ref_tally_tally_tally_ref(pointer) = root.get_middle().get_leaf() else { panic!("leaf") };
    &*pointer as *const _ as usize
}
fn check_scalars(root: &Value, seed: i64) {
    assert_eq!(RecordBorrows_readRoot(root.clone()), seed);
    assert_eq!(RecordBorrows_readMiddle(root.clone()), seed + 2);
    assert_eq!(RecordBorrows_readDeep(root.clone()), seed + 5);
    assert_eq!(RecordBorrows_readNumber(root.clone()), 3.5);
    assert!(RecordBorrows_readBoolean(root.clone()));
    assert_eq!(RecordBorrows_readChar(root.clone()), 'λ');
    assert_eq!(RecordBorrows_readCollision(root.clone()), seed * 3 + 29);
    assert_eq!(values(root), [seed, seed + 2, seed + 5, seed + 11, seed + 13]);
    check_payloads(root, seed);
}
fn check_payloads(root: &Value, original_seed: i64) {
    assert_eq!(root.get_title().unwrap_string(), "root");
    assert_eq!(RecordBorrows_ownedString(root.clone()), "leaf");
    let saved = RecordBorrows_ownedFunction(root.clone());
    let Saved::Saved(action) = saved.as_ref();
    assert_eq!(action.clone()(()), original_seed + 9);
}

fn reads_then_writes() {
    for seed in [-7, 0, 17] {
        for mask in 0..8 {
            let root = RecordBorrows_sample(seed);
            let addresses = [root_address(&root), middle_address(&root), leaf_address(&root)];
            let old_root = (mask & 1 != 0).then(|| root.clone());
            let old_middle = (mask & 2 != 0).then(|| root.get_middle());
            let old_leaf = (mask & 4 != 0).then(|| root.get_middle().get_leaf());
            // Each public call owns its argument; no temporary borrow can
            // survive the call and interfere with the subsequent write.
            for _ in 0..3 { check_scalars(&root, seed); }
            let changed = RecordBorrows_writeAfterRead(root);
            assert_eq!(values(&changed), [seed + 5, seed + 3, seed + 6, seed + 11, seed + 13]);
            assert_eq!(root_address(&changed) == addresses[0], mask & 1 == 0);
            assert_eq!(middle_address(&changed) == addresses[1], mask & 3 == 0);
            assert_eq!(leaf_address(&changed) == addresses[2], mask == 0);
            assert_eq!(RecordBorrows_readDeep(changed.clone()), seed + 6);
            assert_eq!(RecordBorrows_readNumber(changed.clone()), 3.5);
            assert!(RecordBorrows_readBoolean(changed.clone()));
            assert_eq!(RecordBorrows_readChar(changed.clone()), 'λ');
            assert_eq!(RecordBorrows_ownedString(changed.clone()), "leaf");
            check_payloads(&changed, seed);
            if let Some(old) = old_root { check_scalars(&old, seed); }
            if let Some(old) = old_middle {
                assert_eq!(old.get_offset().unwrap_int(), seed + 2);
                assert_eq!(old.get_leaf().get_tally().unwrap_int(), seed + 5);
            }
            if let Some(old) = old_leaf {
                assert_eq!(old.get_tally().unwrap_int(), seed + 5);
                assert_eq!(old.get_note().unwrap_string(), "leaf");
            }
            let changed_again = RecordBorrows_writeAfterRead(changed);
            assert_eq!(values(&changed_again), [seed + 6, seed + 4, seed + 7, seed + 11, seed + 13]);
            check_payloads(&changed_again, seed);
        }
        let versions = RecordBorrows_retain(RecordBorrows_sample(seed));
        let Versions::Versions(changed, old) = versions.as_ref();
        assert_eq!(values(changed), [seed + 5, seed + 3, seed + 6, seed + 11, seed + 13]);
        check_scalars(old, seed);
    }
}

fn owned_results_and_captures() {
    // Consuming the root must leave returned records, strings and functions owned.
    let middle = RecordBorrows_ownedMiddle(RecordBorrows_sample(7));
    assert_eq!(middle.get_offset().unwrap_int(), 9);
    assert_eq!(middle.get_leaf().get_tally().unwrap_int(), 12);
    let mut leaf = RecordBorrows_ownedLeaf(RecordBorrows_sample(7));
    leaf.set_tally(mk_int(88));
    assert_eq!(leaf.get_tally().unwrap_int(), 88);
    let text = RecordBorrows_ownedString(RecordBorrows_sample(7));
    assert_eq!(text, "leaf");
    let saved_action = RecordBorrows_ownedFunction(RecordBorrows_sample(7));
    let Saved::Saved(action) = saved_action.as_ref();
    assert_eq!(action.clone()(()), 16);

    let root = RecordBorrows_sample(7);
    let saved = RecordBorrows_save(root.clone());
    let changed = RecordBorrows_writeAfterRead(root);
    assert_eq!(RecordBorrows_readDeep(changed), 13);
    let Saved::Saved(action) = saved.as_ref();
    assert_eq!(action.clone()(()), 12, "A returned closure retains the old root");
    assert_eq!(action.clone()(()), 12);

    let drops = Rc::new(());
    let held = drops.clone();
    let root = RecordBorrows_withAction(Func1::Shared(Rc::new(move |_| { let _hold = &held; 99 })), RecordBorrows_sample(7));
    let saved_action = RecordBorrows_ownedFunction(root);
    let Saved::Saved(action) = saved_action.as_ref();
    let returned = action.clone();
    drop(saved_action);
    assert_eq!(Rc::strong_count(&drops), 2, "The owned getter keeps the callback capture alive");
    assert_eq!(returned.clone()(()), 99);
    drop(returned);
    assert_eq!(Rc::strong_count(&drops), 1, "Dropping the result releases the final capture");
}

fn opaque_order_and_unwind() {
    let order = Rc::new(RefCell::new(Vec::new()));
    let original = RecordBorrows_sample(7);
    let observed = original.clone();
    let trace = order.clone();
    let make = Func1::Shared(Rc::new(move |root: Value| {
        trace.borrow_mut().push(1);
        check_scalars(&observed, 7);
        assert_eq!(values(&root), values(&observed));
        RecordBorrows_sample(100)
    }));
    assert_eq!(RecordBorrows_callerOpaque(make, original.clone()), 105);
    assert_eq!(*order.borrow(), [1], "Evaluate the opaque receiver exactly once");
    check_scalars(&original, 7);
    order.borrow_mut().clear();
    let trace = order.clone();
    let make = Func1::Shared(Rc::new(move |_: Value| { trace.borrow_mut().push(1); RecordBorrows_sample(100) }));
    let trace = order.clone();
    let consume = Func1::Shared(Rc::new(move |scalar: i64| { trace.borrow_mut().push(2); scalar + 1 }));
    assert_eq!(RecordBorrows_orderedOpaque(consume, make, original.clone()), 106);
    assert_eq!(*order.borrow(), [1, 2], "The getter runs after its receiver and before the consumer");
    order.borrow_mut().clear();
    let trace = order.clone();
    let make = Func1::Shared(Rc::new(move |_: Value| -> Value { trace.borrow_mut().push(1); panic!("opaque receiver"); }));
    let trace = order.clone();
    let consume = Func1::Shared(Rc::new(move |scalar: i64| { trace.borrow_mut().push(2); scalar }));
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(||
        RecordBorrows_orderedOpaque(consume, make, original.clone()))).is_err());
    assert_eq!(*order.borrow(), [1]);
    check_scalars(&original, 7);
    assert_eq!(Rc::strong_count(&order), 1, "Temporary callbacks release their captures during unwind");
}

fn primitive_contexts() {
    for seed in [-7, 0, 17] {
        let root = RecordBorrows_sample(seed);
        assert!(!RecordBorrows_notFlag(root.clone()));
        assert_eq!(RecordBorrows_negateTally(root.clone()), -(seed + 5));
        assert_eq!(RecordBorrows_negateRatio(root.clone()), -3.5);
        assert_eq!(RecordBorrows_numberPlus(-2.0, root.clone()), 1.5);
        for (bound, expected) in [(3.0, false), (3.5, false), (4.0, true)] {
            assert_eq!(RecordBorrows_numberBefore(bound, root.clone()), expected);
        }
        for (bound, expected) in [('z', false), ('λ', false), ('μ', true)] {
            assert_eq!(RecordBorrows_charBefore(bound, root.clone()), expected);
        }
        assert_eq!(RecordBorrows_branchRead(root.clone()), seed + 5);
        check_scalars(&root, seed);
    }
    for flag in [false, true] {
        let mut root = RecordBorrows_sample(7);
        let mut middle = root.get_middle();
        let mut leaf = middle.get_leaf();
        leaf.set_flag(mk_bool(flag)); middle.set_leaf(leaf); root.set_middle(middle);
        assert_eq!(RecordBorrows_notFlag(root.clone()), !flag);
        assert_eq!(RecordBorrows_branchRead(root.clone()), if flag { 12 } else { 9 });
        for callback_result in [false, true] {
            let events = Rc::new(RefCell::new(Vec::new()));
            let trace = events.clone();
            let captured = root.clone();
            let next = Func1::Shared(Rc::new(move |_| {
                assert_eq!(RecordBorrows_readBoolean(captured.clone()), flag);
                trace.borrow_mut().push(1);
                callback_result
            }));
            assert_eq!(RecordBorrows_andThen(next, root.clone()), flag && callback_result);
            assert_eq!(events.borrow().as_slice(), if flag { &[1][..] } else { &[][..] }, "AND evaluates its callback only after a true field");
            events.borrow_mut().clear();
            let trace = events.clone();
            let captured = root.clone();
            let next = Func1::Shared(Rc::new(move |_| {
                assert_eq!(RecordBorrows_readBoolean(captured.clone()), flag);
                trace.borrow_mut().push(2);
                callback_result
            }));
            assert_eq!(RecordBorrows_orElse(next, root.clone()), flag || callback_result);
            assert_eq!(events.borrow().as_slice(), if flag { &[][..] } else { &[2][..] }, "OR evaluates its callback only after a false field");
            assert_eq!(Rc::strong_count(&events), 1, "Callbacks and captures are released after short-circuiting");
            assert_eq!(RecordBorrows_readBoolean(root.clone()), flag);
        }
    }
}

fn main() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if !matches!(info.payload().downcast_ref::<&str>(), Some(&"opaque receiver")) { default_hook(info); }
    }));
    reads_then_writes();
    owned_results_and_captures();
    opaque_order_and_unwind();
    primitive_contexts();
    println!("Record scalar borrows: Int/Number/Boolean/Char at 1-3 levels, unary/binary operations, short-circuit callback order, branch conditions, field-name collisions, 8 sharing masks, writes after reads, owned returns, captures and unwind checked.");
}
