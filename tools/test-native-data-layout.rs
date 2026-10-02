#![allow(warnings)]
use purust_core::*;
use std::sync::Arc as Rc;
use Purs_Data_Map_Internal::Map;
use Purs_Data_Tuple::Tuple;
// NATIVE_FFI

fn reference(enums: Rc<Map>, module: String, name: String) -> bool {
    let ord = Purs_Data_Tuple::Data_Tuple_ordTuple(
        Purs_Data_Ord::Data_Ord_ordString(), Purs_Data_Ord::Data_Ord_ordString());
    let key = Value::Class(Rc::new(Rc::new(Tuple::Tuple(Value::String(module.replace('.', "_")), Value::String(name)))));
    Purs_Data_Set::Data_Set_member(ord, key, enums)
}

fn check(enums: &Rc<Map>, module: &str, name: &str) {
    let fallback = Func3::Static(|_, _, _| panic!("unexpected fallback"));
    let actual = Purust_DataLayout_memberLayoutImpl(fallback, enums.clone(), module.to_owned(), name.to_owned());
    assert_eq!(actual, reference(enums.clone(), module.to_owned(), name.to_owned()), "{module:?} / {name:?}");
}

fn main() {
    let ord = Purs_Data_Tuple::Data_Tuple_ordTuple(
        Purs_Data_Ord::Data_Ord_ordString(), Purs_Data_Ord::Data_Ord_ordString());
    let mut enums = Rc::new(Map::Leaf);
    let mut versions = vec![enums.clone()];
    let mut words: Vec<String> = ["", "A", "A.B", "A_B", "B", "Box", "type", "$opaque$Box", "é", "Ω", "😀", "\0"]
        .iter().map(|word| purust_string_from_utf8(word)).collect();
    for unit in [0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff] {
        words.push(purust_char_from_code_unit(unit).to_string());
    }
    let mut seed = 42u32;
    let mut next = || { seed = seed.wrapping_mul(1664525).wrapping_add(1013904223); seed as usize };
    for i in 0..512 {
        let module = words[next() % words.len()].replace('.', "_");
        let name = words[next() % words.len()].clone();
        let key = Value::Class(Rc::new(Rc::new(Tuple::Tuple(Value::String(module), Value::String(name)))));
        enums = Purs_Data_Set::Data_Set_insert(ord.clone(), key, enums);
        if i % 32 == 0 { versions.push(enums.clone()); }
    }
    versions.push(enums);
    let mut checks = 0;
    for set in &versions {
        for module in &words { for name in &words {
            check(set, module, name);
            check(set, module, &format!("$opaque${name}"));
            checks += 2;
        }}
    }
    // All threads borrow the same immutable tree; retained earlier versions are
    // exercised above to catch accidental mutation of shared AVL nodes.
    std::thread::scope(|scope| {
        for _ in 0..8 {
            let words = &words; let versions = &versions;
            scope.spawn(move || {
                for set in versions { for name in words { check(set, "A.B", name); } }
            });
        }
    });
    println!("Native data-layout membership: {checks} differential lookups, UTF-16 ordering, persistent versions and 8 concurrent readers passed");
}
