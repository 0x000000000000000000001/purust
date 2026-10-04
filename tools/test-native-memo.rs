#![allow(warnings)]
//! Native differential contract for the BoundedMemo FFI on the threaded Arc
//! model. The cases mirror `test/bounded-memo.mjs` (JavaScript contract) and
//! `test/bounded-memo-native_test.go` (Go/FFI contract):
//!
//! - a compiler tree reboxed in a fresh outer `Rc<dyn Any>` per call keys on
//!   the shared inner `Rc<ExprType>` / `Rc<BackendSyntax>` allocation;
//! - distinct allocations with identical structure never share an entry;
//! - closures with identical code and different captures never share;
//! - keys retain their owners until FIFO eviction, which releases them;
//! - primitive Int/String/Char/Bool keys compare by value and NaN/-0 follow
//!   the JavaScript SameValueZero contract;
//! - a reentrant callback runs without the cache lock (no deadlock);
//! - each effect execution owns an independent cache.
use purust_core::*;
use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};
use std::sync::{Arc as Rc, Mutex};
use Purs_PureScript_Backend_Optimizer_BoundedMemo::{
    PureScript_Backend_Optimizer_BoundedMemo_createBoundedMemo,
    PureScript_Backend_Optimizer_BoundedMemo_createStringMemo,
};
use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType;
use Purs_PureScript_Backend_Optimizer_Syntax::BackendSyntax;

fn counter() -> Rc<AtomicUsize> {
    Rc::new(AtomicUsize::new(0))
}

fn tally(calls: &Rc<AtomicUsize>) -> Value {
    let calls = calls.clone();
    Value::Func2(Func2::Shared(Rc::new(move |_a: Value, _b: Value| -> Value {
        calls.fetch_add(1, AtomicOrdering::SeqCst);
        Value::Unit
    })))
}

fn count(calls: &Rc<AtomicUsize>) -> usize {
    calls.load(AtomicOrdering::SeqCst)
}

fn expr_key(inner: Rc<ExprType>) -> Value {
    Value::Class(Rc::new(inner))
}

fn syntax_key(inner: Rc<BackendSyntax>) -> Value {
    Value::Class(Rc::new(inner))
}

// Generator-produced shared owners: one tree allocation keyed through
// ClassShared must hit the same entry as its nested Class form.
fn expr_key_shared(inner: Rc<ExprType>) -> Value {
    Value::ClassShared(inner)
}

fn syntax_key_shared(inner: Rc<BackendSyntax>) -> Value {
    Value::ClassShared(inner)
}

fn open(capacity: i64, callback: Value) -> Value {
    PureScript_Backend_Optimizer_BoundedMemo_createBoundedMemo(capacity, callback)
        .unwrap_func1()(Value::Unit)
}

fn open_strings(capacity: i64, callback: Value) -> Value {
    PureScript_Backend_Optimizer_BoundedMemo_createStringMemo(capacity, callback)
        .unwrap_func1()(Value::Unit)
}

fn apply(memo: &Value, a: Value, b: Value) -> Value {
    memo.unwrap_func2()(a, b)
}

fn reboxed_tree_identity() {
    let calls = counter();
    let memo = open(512, tally(&calls));

    let tree = Rc::new(ExprType::TypeVar(String::from("a")));
    for _ in 0..3 {
        apply(&memo, expr_key(tree.clone()), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        1,
        "fresh outer boxes around one ExprType tree must hit one entry"
    );

    let nested = Rc::new(ExprType::Array(Rc::new(ExprType::Int)));
    for _ in 0..2 {
        apply(&memo, expr_key(nested.clone()), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        2,
        "a nested tree keeps its inner allocation identity across reboxing"
    );

    let tree = Rc::new(BackendSyntax::PrimUndefined);
    for _ in 0..3 {
        apply(&memo, syntax_key(tree.clone()), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        3,
        "fresh outer boxes around one BackendSyntax tree must hit one entry"
    );

    let tree = Rc::new(ExprType::TypeVar(String::from("s")));
    for _ in 0..3 {
        apply(&memo, expr_key_shared(tree.clone()), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        4,
        "fresh ClassShared carriers around one ExprType tree must hit one entry"
    );
    apply(&memo, expr_key(tree.clone()), Value::Unit);
    assert_eq!(
        count(&calls),
        4,
        "the same tree must share one entry across both carriers"
    );
}

fn distinct_allocations_do_not_share() {
    let calls = counter();
    let memo = open(512, tally(&calls));

    for _ in 0..2 {
        apply(
            &memo,
            expr_key(Rc::new(ExprType::TypeVar(String::from("a")))),
            Value::Unit,
        );
    }
    assert_eq!(
        count(&calls),
        2,
        "equal ExprType trees at distinct addresses must not share"
    );

    for _ in 0..2 {
        apply(&memo, syntax_key(Rc::new(BackendSyntax::PrimUndefined)), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        4,
        "equal BackendSyntax trees at distinct addresses must not share"
    );

    apply(
        &memo,
        expr_key(Rc::new(ExprType::TypeVar(String::from("a")))),
        Value::Unit,
    );
    apply(
        &memo,
        expr_key(Rc::new(ExprType::TypeVar(String::from("b")))),
        Value::Unit,
    );
    assert_eq!(
        count(&calls),
        6,
        "same type-variable name with a different address must not share"
    );
}

fn closures_do_not_share() {
    let calls = counter();
    let memo = open(512, tally(&calls));
    let captured = |value: i64| {
        Value::Func1(Func1::Shared(Rc::new(move |_: Value| Value::Int(value))))
    };
    let first = captured(1);
    let second = captured(2);
    for _ in 0..2 {
        apply(&memo, first.clone(), Value::Unit);
        apply(&memo, second.clone(), Value::Unit);
    }
    assert_eq!(
        count(&calls),
        4,
        "closures with identical code and different captures must not share a key"
    );
}

fn fifo_eviction_and_owner_lifetime() {
    // FIFO, not LRU: a hit does not make the oldest entry newer.
    let calls = counter();
    let memo = open(2, tally(&calls));
    apply(&memo, Value::Int(1), Value::Int(0));
    apply(&memo, Value::Int(2), Value::Int(0));
    apply(&memo, Value::Int(1), Value::Int(0));
    apply(&memo, Value::Int(3), Value::Int(0));
    apply(&memo, Value::Int(2), Value::Int(0));
    assert_eq!(count(&calls), 3, "a hit must not refresh the FIFO position");
    apply(&memo, Value::Int(1), Value::Int(0));
    assert_eq!(count(&calls), 4, "the oldest entry must be the one evicted");

    // The cache retains the inner tree owner while the key is live, then
    // releases it on eviction so a recycled address cannot alias.
    let calls = counter();
    let memo = open(1, tally(&calls));
    let tree = Rc::new(ExprType::Int);
    let weak = Rc::downgrade(&tree);
    apply(&memo, expr_key(tree.clone()), Value::Unit);
    drop(tree);
    assert!(
        weak.upgrade().is_some(),
        "a cached ExprType key must retain its inner tree"
    );
    apply(&memo, expr_key(Rc::new(ExprType::String)), Value::Unit);
    assert!(
        weak.upgrade().is_none(),
        "an evicted ExprType key must release its inner tree"
    );

    let calls = counter();
    let memo = open(1, tally(&calls));
    let tree = Rc::new(BackendSyntax::PrimUndefined);
    let weak = Rc::downgrade(&tree);
    apply(&memo, syntax_key(tree.clone()), Value::Unit);
    drop(tree);
    assert!(
        weak.upgrade().is_some(),
        "a cached BackendSyntax key must retain its owner"
    );
    apply(&memo, syntax_key(Rc::new(BackendSyntax::PrimUndefined)), Value::Unit);
    assert!(
        weak.upgrade().is_none(),
        "an evicted BackendSyntax key must release its owner"
    );

    let calls = counter();
    let memo = open(1, tally(&calls));
    let tree = Rc::new(ExprType::Int);
    let weak = Rc::downgrade(&tree);
    apply(&memo, expr_key_shared(tree.clone()), Value::Unit);
    drop(tree);
    assert!(
        weak.upgrade().is_some(),
        "a cached ClassShared ExprType key must retain its owner"
    );
    apply(&memo, expr_key_shared(Rc::new(ExprType::String)), Value::Unit);
    assert!(
        weak.upgrade().is_none(),
        "an evicted ClassShared ExprType key must release its owner"
    );
}

fn primitive_keys() {
    let calls = counter();
    let memo = open(64, tally(&calls));
    apply(&memo, Value::Int(7), Value::Int(0));
    apply(&memo, Value::Int(7), Value::Int(0));
    apply(&memo, Value::Int(8), Value::Int(0));
    apply(&memo, Value::Char('a'), Value::Bool(true));
    apply(&memo, Value::Char('a'), Value::Bool(true));
    apply(&memo, Value::Char('a'), Value::Bool(false));
    apply(&memo, Value::String(String::from("a")), Value::Bool(true));
    assert_eq!(
        count(&calls),
        5,
        "Int/Char/Bool/String keys must compare by value"
    );
    apply(&memo, Value::Number(7.0), Value::Int(0));
    assert_eq!(
        count(&calls),
        6,
        "Int and Number keep distinct native representations"
    );

    // String contents, not String allocations, are the key.
    let calls = counter();
    let memo = open(64, tally(&calls));
    apply(
        &memo,
        Value::String(String::from("Data.Map")),
        Value::String(String::from("lookup")),
    );
    apply(
        &memo,
        Value::String(String::from("Data.Map")),
        Value::String(String::from("lookup")),
    );
    assert_eq!(
        count(&calls),
        1,
        "equal string contents must share even with distinct allocations"
    );
    apply(
        &memo,
        Value::String(String::from("Data.Map")),
        Value::String(String::from("empty")),
    );
    apply(
        &memo,
        Value::String(String::from("Data.Map2")),
        Value::String(String::from("lookup")),
    );
    assert_eq!(count(&calls), 3, "the string key is the (module, name) pair");

    // SameValueZero: every NaN payload collapses to one key, -0.0 equals +0.0.
    let calls = counter();
    let memo = open(64, tally(&calls));
    apply(&memo, Value::Number(f64::NAN), Value::Unit);
    apply(
        &memo,
        Value::Number(f64::from_bits(0x7ff8_0000_0000_0001)),
        Value::Unit,
    );
    apply(&memo, Value::Number(-f64::NAN), Value::Unit);
    assert_eq!(
        count(&calls),
        1,
        "every NaN payload must share the canonical NaN key"
    );
    apply(&memo, Value::Number(1.0), Value::Unit);
    assert_eq!(count(&calls), 2, "a different finite number must miss");
    apply(&memo, Value::Number(-0.0), Value::Unit);
    apply(&memo, Value::Number(0.0), Value::Unit);
    assert_eq!(count(&calls), 3, "-0.0 and +0.0 must share one key");
    apply(&memo, Value::Number(-1.0), Value::Unit);
    assert_eq!(count(&calls), 4);
}

fn reentrant_callback() {
    let holder: Rc<Mutex<Option<Value>>> = Rc::new(Mutex::new(None));
    let calls = counter();
    let callback = {
        let holder = holder.clone();
        let calls = calls.clone();
        Value::Func2(Func2::Shared(Rc::new(move |a: Value, b: Value| -> Value {
            calls.fetch_add(1, AtomicOrdering::SeqCst);
            let n = a.unwrap_int();
            if n == 0 {
                return b;
            }
            let memo = holder.lock().unwrap().as_ref().unwrap().clone();
            let previous = apply(&memo, Value::Int(n - 1), b);
            Value::Int(1 + previous.unwrap_int())
        })))
    };
    let memo = open(512, callback);
    *holder.lock().unwrap() = Some(memo.clone());
    assert_eq!(
        apply(&memo, Value::Int(8), Value::Int(4)).unwrap_int(),
        12,
        "recursive memoized computation"
    );
    assert_eq!(
        count(&calls),
        9,
        "each distinct recursive key runs its callback exactly once"
    );
}

fn effect_executions_are_independent() {
    let calls = counter();
    let effect = PureScript_Backend_Optimizer_BoundedMemo_createBoundedMemo(512, tally(&calls));
    let first = effect.unwrap_func1()(Value::Unit);
    let second = effect.unwrap_func1()(Value::Unit);
    apply(&first, Value::Int(1), Value::Int(2));
    apply(&first, Value::Int(1), Value::Int(2));
    apply(&second, Value::Int(1), Value::Int(2));
    assert_eq!(
        count(&calls),
        2,
        "each effect execution must own an independent cache"
    );

    let calls = counter();
    let memo = open_strings(4, tally(&calls));
    apply(
        &memo,
        Value::String(String::from("A.B")),
        Value::String(String::from("c")),
    );
    apply(
        &memo,
        Value::String(String::from("A.B")),
        Value::String(String::from("c")),
    );
    assert_eq!(count(&calls), 1);
    apply(
        &memo,
        Value::String(String::from("A.B")),
        Value::String(String::from("d")),
    );
    apply(
        &memo,
        Value::String(String::from("A")),
        Value::String(String::from("B.c")),
    );
    assert_eq!(count(&calls), 3, "qualified key pairs must not collide");
}

fn disabled_capacity() {
    for capacity in [0_i64, -1_i64] {
        let calls = counter();
        let memo = open(capacity, tally(&calls));
        apply(&memo, Value::Int(1), Value::Int(1));
        apply(&memo, Value::Int(1), Value::Int(1));
        assert_eq!(
            count(&calls),
            2,
            "capacity <= 0 must disable memoization instead of sharing results"
        );
    }
}

fn main() {
    reboxed_tree_identity();
    distinct_allocations_do_not_share();
    closures_do_not_share();
    fifo_eviction_and_owner_lifetime();
    primitive_keys();
    reentrant_callback();
    effect_executions_are_independent();
    disabled_capacity();
    println!(
        "Native memo: reboxed ExprType/BackendSyntax identity, distinct allocations, closure captures, FIFO retention/release, Int/String/Char/Bool/NaN/-0 keys, reentrancy and fresh effect executions passed"
    );
}
