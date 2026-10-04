#![allow(warnings)]
use purust_core::*;
mod candidate {
    use purust_core::*;
    // NATIVE_FFI
}
use candidate::*;
use std::sync::Arc as Rc;
use Purs_Data_Map_Internal::{Map, Data_Map_Internal_insert, Data_Map_Internal_lookup, Data_Map_Internal_unionWith};
use Purs_Data_Maybe::Maybe;
use Purs_Data_Ord::Ord;
use Purs_PureScript_Backend_Optimizer_CoreFn::Qualified;

fn snapshot(map: &Map) -> String {
    match map {
        Map::Leaf => String::from("_"),
        Map::Node(h, s, k, v, l, r) => format!("({h},{s},{},{},{},{})", key(k), v.unwrap_int(), snapshot(l), snapshot(r)),
    }
}
fn key(value: &Value) -> String {
    match value.resolve() {
        Value::Int(n) => n.to_string(),
        Value::String(s) => format!("{s:?}"),
        _ => {
            let qualified = value.unwrap_class_shared::<Qualified>();
            let Qualified::Qualified(m, i) = qualified.as_ref();
            format!("{}:{}", match m.as_ref() { Maybe::Nothing => "-".to_string(), Maybe::Just(v) => key(v) }, key(i))
        }
    }
}
fn lookup_result(value: &Maybe) -> Option<i64> {
    match value { Maybe::Nothing => None, Maybe::Just(value) => Some(value.unwrap_int()) }
}
fn qualified(module: Option<&str>, ident: &str) -> Value {
    Value::Class(Rc::new(Rc::new(Qualified::Qualified(Rc::new(match module {
        None => Maybe::Nothing, Some(s) => Maybe::Just(Value::String(purust_string_from_utf8(s)))
    }), Value::String(purust_string_from_utf8(ident))))))
}
// A generator-produced shared owner for the same Qualified value.
fn qualified_shared(module: Option<&str>, ident: &str) -> Value {
    Value::ClassShared(Rc::new(Qualified::Qualified(Rc::new(match module {
        None => Maybe::Nothing, Some(s) => Maybe::Just(Value::String(purust_string_from_utf8(s)))
    }), Value::String(purust_string_from_utf8(ident)))))
}
type Insert = fn(Value, Value, Value, Rc<Map>) -> Rc<Map>;
type Lookup = fn(Value, Value, Rc<Map>) -> Rc<Maybe>;
fn compare_operations(keys: &[Value], ord: Rc<Ord>, insert: Insert, lookup: Lookup) {
    let mut native = Rc::new(Map::Leaf);
    let mut oracle = native.clone();
    let mut previous = Vec::new();
    let mut random = 42_u64;
    for i in 0..800 {
        random = random.wrapping_mul(6364136223846793005).wrapping_add(1);
        let k = keys[random as usize % keys.len()].clone();
        if i % 37 == 0 { previous.push((native.clone(), snapshot(&native))); }
        native = insert(Value::Unit, k.clone(), Value::Int(i), native);
        oracle = Data_Map_Internal_insert(ord.clone(), k, Value::Int(i), oracle);
        assert_eq!(snapshot(&native), snapshot(&oracle), "insert shape, heights, sizes and values");
        for k in keys {
            assert_eq!(lookup_result(&lookup(Value::Unit, k.clone(), native.clone())),
                lookup_result(&Data_Map_Internal_lookup(ord.clone(), k.clone(), oracle.clone())));
        }
    }
    for (version, expected) in previous { assert_eq!(snapshot(&version), expected, "old version changed"); }
}
fn main() {
    let ints: Vec<Value> = (-31..35).map(Value::Int).collect();
    compare_operations(&ints, Purs_Data_Ord::Data_Ord_ordInt(),
        PureScript_Backend_Optimizer_NativeMaps_insertIntImpl, PureScript_Backend_Optimizer_NativeMaps_lookupIntImpl);
    let strings: Vec<Value> = ["", "a", "A", "z", "é", "🦀", "😀", "\u{e000}", "a.b", "a_b"].iter()
        .map(|s| Value::String(purust_string_from_utf8(s))).chain([
            Value::String(purust_string_from_utf16(&[0xd800])), Value::String(purust_string_from_utf16(&[0xdc00]))
        ]).collect();
    compare_operations(&strings, Purs_Data_Ord::Data_Ord_ordString(),
        PureScript_Backend_Optimizer_NativeMaps_insertStringImpl, PureScript_Backend_Optimizer_NativeMaps_lookupStringImpl);
    let quals: Vec<Value> = [None, Some(""), Some("A"), Some("B"), Some("é")].into_iter()
        .flat_map(|m| ["", "x", "y", "🦀"].into_iter().map(move |i| qualified(m, i))).collect();
    compare_operations(&quals, Purs_PureScript_Backend_Optimizer_CoreFn::PureScript_Backend_Optimizer_CoreFn_ordQualified(Purs_Data_Ord::Data_Ord_ordString()),
        PureScript_Backend_Optimizer_NativeMaps_insertQualifiedIdentImpl, PureScript_Backend_Optimizer_NativeMaps_lookupQualifiedIdentImpl);
    // ClassShared and mixed carriers of the same Qualified keys must order and
    // collide exactly like their legacy nested Class forms.
    let mut carriers: Vec<Value> = Vec::new();
    for module in [None, Some("A"), Some("é")] {
        for ident in ["", "x", "🦀"] {
            carriers.push(qualified(module, ident));
            carriers.push(qualified_shared(module, ident));
        }
    }
    compare_operations(&carriers, Purs_PureScript_Backend_Optimizer_CoreFn::PureScript_Backend_Optimizer_CoreFn_ordQualified(Purs_Data_Ord::Data_Ord_ordString()),
        PureScript_Backend_Optimizer_NativeMaps_insertQualifiedIdentImpl, PureScript_Backend_Optimizer_NativeMaps_lookupQualifiedIdentImpl);
    let ord = Purs_Data_Ord::Data_Ord_ordInt();
    let compare = ord.compare.clone();
    let combine = Func2::Static(|a: Value, b: Value| Value::Int(a.unwrap_int() * 10 - b.unwrap_int()));
    for offset in 0..strings.len() {
        let string_ord = Purs_Data_Ord::Data_Ord_ordString();
        let mut a = Rc::new(Map::Leaf);
        let mut b = a.clone();
        for (i, key) in strings.iter().enumerate() {
            if i <= offset { a = Data_Map_Internal_insert(string_ord.clone(), key.clone(), Value::Int(i as i64), a); }
            if i >= offset { b = Data_Map_Internal_insert(string_ord.clone(), key.clone(), Value::Int(100 + i as i64), b); }
        }
        let expected = Data_Map_Internal_unionWith(string_ord.clone(), combine.clone(), a.clone(), b.clone());
        assert_eq!(snapshot(&PureScript_Backend_Optimizer_NativeMaps_unionWithStringImpl(Value::Unit, combine.clone(), a.clone(), b.clone())), snapshot(&expected));
        let left_biased = Data_Map_Internal_unionWith(string_ord, Func2::Static(|a, _| a), a.clone(), b.clone());
        assert_eq!(snapshot(&PureScript_Backend_Optimizer_NativeMaps_unionStringImpl(Value::Unit, a, b)), snapshot(&left_biased));
    }
    for size in 0..64 {
        let mut a = Rc::new(Map::Leaf);
        let mut b = a.clone();
        for i in 0..size {
            a = Data_Map_Internal_insert(ord.clone(), Value::Int(i * 3 % 67), Value::Int(i), a);
            b = Data_Map_Internal_insert(ord.clone(), Value::Int(i * 7 % 83), Value::Int(i + 1), b);
        }
        let old_a = snapshot(&a); let old_b = snapshot(&b);
        let expected = Data_Map_Internal_unionWith(ord.clone(), combine.clone(), a.clone(), b.clone());
        let native = PureScript_Backend_Optimizer_NativeMaps_unionWithIntImpl(Value::Unit, combine.clone(), a.clone(), b.clone());
        assert_eq!(snapshot(&native), snapshot(&expected), "union structure/combine argument order");
        let callbacks = PureScript_Backend_Optimizer_NativeMaps_unionWithTcoRefImpl(Value::Unit, compare.clone(), combine.clone(), a.clone(), b.clone());
        assert_eq!(snapshot(&callbacks), snapshot(&expected));
        let inserted = PureScript_Backend_Optimizer_NativeMaps_insertEvalRefImpl(Value::Unit, compare.clone(), Value::Int(10), Value::Int(999), a.clone());
        let expected = Data_Map_Internal_insert(ord.clone(), Value::Int(10), Value::Int(999), a.clone());
        assert_eq!(snapshot(&inserted), snapshot(&expected));
        for i in -1..90 {
            let result = PureScript_Backend_Optimizer_NativeMaps_lookupEvalRefImpl(Value::Unit, compare.clone(), Value::Int(i), inserted.clone());
            assert_eq!(lookup_result(&result), lookup_result(&Data_Map_Internal_lookup(ord.clone(), Value::Int(i), expected.clone())));
            assert_eq!(PureScript_Backend_Optimizer_NativeMaps_memberEvalRefImpl(Value::Unit, compare.clone(), Value::Int(i), inserted.clone()), lookup_result(&result).is_some());
        }
        assert_eq!(snapshot(&a), old_a); assert_eq!(snapshot(&b), old_b);
    }
    println!("Native Maps: differential insert/lookup/union, exact AVL shape, Unicode keys, comparator callbacks and persistence passed");
}
