#![allow(warnings)]
use purust_core::*;
use std::sync::Arc;
use Purs_Data_Map_Internal::Map;
use Purs_Purust_CodeGen as cg;

fn empty() -> Arc<Map> { Arc::new(Map::Leaf) }
fn strings(xs: &[&str]) -> Value { mk_array(xs.iter().map(|s| Value::String(purust_string_from_utf8(s))).collect()) }
fn insert(map: Arc<Map>, key: &str, value: &str) -> Arc<Map> {
    Purs_Data_Map_Internal::Data_Map_Internal_insert(Purs_Data_Ord::Data_Ord_ordString(),
        Value::String(purust_string_from_utf8(key)), Value::String(purust_string_from_utf8(value)), map)
}
fn check(map: &Arc<Map>, names: &[&str]) -> String {
    let fields = strings(names);
    let reference = cg::Purust_CodeGen_recordStructNameReference(map.clone(), fields.clone());
    let native = cg::Purust_CodeGen_recordStructNameImpl(Func2::Static(|_: Arc<Map>, _: Value| -> String {
        panic!("valid field names delegated")
    }), map.clone(), fields.clone());
    let wrapped = cg::Purust_CodeGen_recordStructName(map.clone(), fields);
    assert_eq!(native, reference, "native {names:?}");
    assert_eq!(wrapped, reference, "wrapper {names:?}");
    reference
}
fn main() {
    let empty_map = empty();
    assert_eq!(check(&empty_map, &[]), "Record_a");
    assert_eq!(check(&empty_map, &[""]), "Record_a");
    assert_eq!(check(&empty_map, &["a", "a"]), "ClosedRecord_a");
    assert_eq!(check(&empty_map, &["b", "a", "b"]), "Record_a_b");
    assert_eq!(check(&empty_map, &["", "a"]), "Record__a");
    let collision = insert(insert(empty(), "a", "same"), "b", "same");
    assert_eq!(check(&collision, &["b", "a", "b"]), "Record_same_same");
    let mut map = empty();
    for (key, value) in [("match", "mapped"), ("self", "self_kw"), ("self_kw", "self_kw_1"),
        ("é", "renamed"), ("😀", "emoji"), ("x", ""), ("q", "a")] { map = insert(map, key, value); }
    assert_eq!(check(&map, &["q"]), "ClosedRecord_a");
    assert_eq!(check(&map, &["x"]), "Record_a");
    let pool = ["", "a", "a", "x", "q", "match", "self", "self_kw", "_", "9", "10", "type", "x-y", "x.y", "x'", "$",
        "é", "😀", "τ", "\u{e000}", "\u{10000}", "a😀", "quote\""];
    let mut state = 0x9e3779b97f4a7c15u64;
    let mut checks = 8;
    for _ in 0..512 {
        let mut names = vec![];
        for _ in 0..(state as usize % 21) {
            state ^= state << 13; state ^= state >> 7; state ^= state << 17;
            names.push(pool[state as usize % pool.len()]);
        }
        // Empty lists must still advance the deterministic generator.
        state = state.wrapping_add(0x9e3779b97f4a7c15);
        check(&empty_map, &names); check(&map, &names); checks += 2;
    }
    for bad in [Value::Int(1), mk_array(vec![Value::Int(2)])] {
        let result = cg::Purust_CodeGen_recordStructNameImpl(Func2::Static(|_: Arc<Map>, _: Value| "delegated".into()), empty(), bad);
        assert_eq!(result, "delegated");
    }
    println!("Native record names: {checks} exact canonicalization/renaming cases / two fallback probes passed");
}
