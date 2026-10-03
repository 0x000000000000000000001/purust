#![allow(warnings)]
// Differential test for the native field-name transforms.
//
// Public generated symbols under test (threaded build):
//   Purust_CodeGen_fieldBaseReference        (Map) -> String -> String  pure PS oracle
//   Purust_CodeGen_fieldBase                 (Map) -> String -> String  production wrapper
//   Purust_CodeGen_fieldBaseImpl             Func2<Map, String, String> -> Map -> String -> String
// and the recordFieldIdent triple.
//
// Any delegation of the generated `...Impl` fast path on a well-formed
// (Map, String) input is a failure: the native path must handle hits, misses,
// keyword precedence, escapes and UTF-16 exactly like the PureScript reference.
use purust_core::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc as Rc;
use Purs_Data_Map_Internal::Map;
use Purs_Purust_CodeGen::{
    Purust_CodeGen_fieldBase, Purust_CodeGen_fieldBaseImpl, Purust_CodeGen_fieldBaseReference,
    Purust_CodeGen_recordFieldIdent, Purust_CodeGen_recordFieldIdentImpl,
    Purust_CodeGen_recordFieldIdentReference,
};

// CodeGen.purs `rawFieldKeywords` (35 entries).
const RAW_KEYWORDS: &[&str] = &[
    "abstract", "async", "await", "become", "box", "const", "continue", "do",
    "dyn", "else", "enum", "extern", "false", "final", "for", "impl", "in",
    "macro", "match", "override", "priv", "return", "static", "struct",
    "trait", "true", "try", "typeof", "unsafe", "unsized", "virtual",
    "where", "while", "yield",
];
// CodeGen.purs `unrawableFieldKeywords` (4 entries).
const UNRAWABLE_KEYWORDS: &[&str] = &["crate", "self", "Self", "super"];

// Runtime strings store one Rust scalar per UTF-16 code unit; surrogates are
// shifted past the Rust hole. Isolated surrogates stay representable.
fn from_units(units: &[u16]) -> String {
    units.iter().map(|unit| purust_char_from_code_unit(*unit)).collect()
}

fn field(value: &str) -> String {
    purust_string_from_utf8(value)
}

fn insert(map: Rc<Map>, key: &str, value: &str) -> Rc<Map> {
    Purs_Data_Map_Internal::Data_Map_Internal_insert(
        Purs_Data_Ord::Data_Ord_ordString(),
        Value::String(field(key)),
        Value::String(field(value)),
        map,
    )
}

fn map_from(entries: &[(&str, &str)]) -> Rc<Map> {
    let mut map = Rc::new(Map::Leaf);
    for (key, value) in entries {
        map = insert(map, key, value);
    }
    map
}

fn base_reference(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_fieldBaseReference(renames.clone(), field(name))
}

fn base_wrapper(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_fieldBase(renames.clone(), field(name))
}

fn base_native(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_fieldBaseImpl(
        Func2::Static(|_: Rc<Map>, name: String| -> String {
            panic!("fieldBase delegated to fallback for {name:?}")
        }),
        renames.clone(),
        field(name),
    )
}

fn ident_reference(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_recordFieldIdentReference(renames.clone(), field(name))
}

fn ident_wrapper(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_recordFieldIdent(renames.clone(), field(name))
}

fn ident_native(renames: &Rc<Map>, name: &str) -> String {
    Purust_CodeGen_recordFieldIdentImpl(
        Func2::Static(|_: Rc<Map>, name: String| -> String {
            panic!("recordFieldIdent delegated to fallback for {name:?}")
        }),
        renames.clone(),
        field(name),
    )
}

fn check(renames: &Rc<Map>, cases: &[String], hint: &str) -> usize {
    let mut comparisons = 0;
    for name in cases {
        let reference = base_reference(renames, name);
        assert_eq!(base_native(renames, name), reference, "fieldBase native {hint} {name:?}");
        assert_eq!(base_wrapper(renames, name), reference, "fieldBase wrapper {hint} {name:?}");

        let reference = ident_reference(renames, name);
        assert_eq!(ident_native(renames, name), reference, "recordFieldIdent native {hint} {name:?}");
        assert_eq!(ident_wrapper(renames, name), reference, "recordFieldIdent wrapper {hint} {name:?}");
        comparisons += 4;
    }
    comparisons
}

fn field_cases() -> Vec<String> {
    let mut cases: Vec<String> = Vec::new();
    for keyword in RAW_KEYWORDS {
        cases.push(field(keyword));
    }
    for keyword in UNRAWABLE_KEYWORDS {
        cases.push(field(keyword));
    }
    for value in [
        // empty, lone underscore, leading underscores
        "", "_", "__", "_x", "x_",
        // digits: sanitizeIdent keeps them; fieldBasePure prefixes the result
        "0", "1", "9", "123", "0abc", "9λ",
        // non-ASCII, non-BMP and mixed
        "λ", "é", "😀", "😀x", "x😀", "😀😀",
        // escaped characters
        "'", "$", "-", ".", "\"",
        "a'b", "a$b", "a-b", "a.b", "a\"b",
        "a b", "a\tb", "a\nb", "a\0b",
        // sanitizeIdent Rust-keyword rewrites and already-rewritten names
        "type", "ref", "mut", "move", "let", "if", "loop", "fn", "gen",
        "use", "pub", "break", "mod", "as", "_kw", "type_kw",
        // method/field prefixes used by the prelude
        "record", "get_x", "set_x", "borrow_x", "r#type", "__purust_take",
        // aliases of rewritten keyword fields
        "crate_kw", "self_kw",
    ] {
        cases.push(field(value));
    }
    // Isolated surrogates and mixes: these cannot come from purust_string_from_utf8.
    cases.push(from_units(&[0xd800]));
    cases.push(from_units(&[0xdfff]));
    cases.push(from_units(&[0x0061, 0xd800, 0x0062]));
    cases.push(from_units(&[0xdc00, 0x0041]));
    cases.push(from_units(&[0xd800, 0xdfff]));
    cases.push(from_units(&[0xd83d, 0xde00]));
    cases.push(from_units(&[0x0041, 0xd83d, 0xde00, 0x0042]));
    cases
}

fn keyword_entries() -> Vec<(&'static str, &'static str)> {
    let mut entries: Vec<(&'static str, &'static str)> =
        RAW_KEYWORDS.iter().map(|keyword| (*keyword, "keyword_hit")).collect();
    entries.extend(UNRAWABLE_KEYWORDS.iter().map(|keyword| (*keyword, "unrawable_hit")));
    entries
}

fn collision_entries() -> Vec<(&'static str, &'static str)> {
    vec![
        // sanitizeIdent keyword rewrites resolved by fieldRenames
        ("type", "type_kw"), ("fn", "fn_kw"), ("gen", "gen_kw"), ("mod", "mod_kw"),
        ("as", "as_kw"), ("move", "move_kw"), ("let", "let_kw"), ("if", "if_kw"),
        ("loop", "loop_kw"), ("use", "use_kw"), ("pub", "pub_kw"), ("ref", "ref_kw"),
        ("mut", "mut_kw"),
        // unrawable keywords with and without a rename hit
        ("crate", "crate_kw"), ("self", "self_1"), ("Self", "Self"), ("super", "super_kw"),
        // escaped and prefixed spellings
        ("_", "_underscore"), ("1abc", "_1abc"), ("a.b", "a_dot_b"), ("a'b", "a_prime"),
        ("$", "dollar"), ("-", "minus"), ("\"", "quote"), ("a b", "a_u32_b"),
        // collisions between a base name and its suffixed twin
        ("x", "x_1"), ("x_1", "x_2"), ("record", "Record_a"), ("get_x", "get_x_1"),
        // values carrying Unicode, empty strings and raw identifiers
        ("x_", "λ😀"), ("unicode_value", ""), ("quote_value", "r#type"),
        ("record_suffix", "type_kw"),
    ]
}

fn shuffled(entries: &[(&'static str, &'static str)], round: usize) -> Vec<(&'static str, &'static str)> {
    let mut result = entries.to_vec();
    let len = result.len();
    for index in 0..len {
        let other = (index * 7 + round * 13 + 3) % len;
        result.swap(index, other);
    }
    result
}

fn fallback_probe(cases: &[String], renames: &Rc<Map>) -> usize {
    let calls = Rc::new(AtomicUsize::new(0));
    let base_counter = calls.clone();
    let base_fallback = Func2::Shared(Rc::new(move |_: Rc<Map>, name: String| -> String {
        base_counter.fetch_add(1, Ordering::Relaxed);
        format!("__fallback__{name}")
    }));
    let ident_counter = calls.clone();
    let ident_fallback = Func2::Shared(Rc::new(move |_: Rc<Map>, name: String| -> String {
        ident_counter.fetch_add(1, Ordering::Relaxed);
        format!("__fallback__{name}")
    }));
    for name in cases {
        let expected = base_reference(renames, name);
        let actual = Purust_CodeGen_fieldBaseImpl(base_fallback.clone(), renames.clone(), field(name));
        if actual != expected {
            assert_eq!(actual, format!("__fallback__{}", field(name)), "fieldBase fallback arguments changed");
        }
        let expected = ident_reference(renames, name);
        let actual = Purust_CodeGen_recordFieldIdentImpl(ident_fallback.clone(), renames.clone(), field(name));
        if actual != expected {
            assert_eq!(actual, format!("__fallback__{}", field(name)), "recordFieldIdent fallback arguments changed");
        }
    }
    calls.load(Ordering::Relaxed)
}

fn main() {
    // Runtime encoding sanity: non-BMP text expands to its UTF-16 code units.
    assert_eq!(field("😀"), from_units(&[0xd83d, 0xde00]), "UTF-16 encoding");
    for unit in [0x0000u16, 0x0041, 0x007f, 0x0080, 0x07ff, 0x0800, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff] {
        assert_eq!(purust_char_to_code_unit(purust_char_from_code_unit(unit)), unit, "code unit round trip {unit:#06x}");
    }

    let cases = field_cases();
    let empty = Rc::new(Map::Leaf);
    let all_hits = map_from(&keyword_entries());
    let collisions = map_from(&collision_entries());

    let mut comparisons = 0;
    let mut maps = 0;
    comparisons += check(&empty, &cases, "empty");
    maps += 1;
    comparisons += check(&all_hits, &cases, "keyword-hits");
    maps += 1;
    comparisons += check(&collisions, &cases, "collisions");
    maps += 1;

    // Same entry set, different insertion orders: identical strings.
    let mut combined = keyword_entries();
    combined.extend(collision_entries());
    // Resolve duplicate keys once with the same last-write-wins rule as insert.
    // Shuffling duplicate writes would change the map's contents, not just its
    // tree shape, and is not an insertion-order equivalence fixture.
    let combined: Vec<_> = combined.into_iter()
        .collect::<std::collections::BTreeMap<_, _>>().into_iter().collect();
    let combined_forward = map_from(&combined);
    comparisons += check(&combined_forward, &cases, "combined");
    maps += 1;
    for round in 0..8 {
        let entries = shuffled(&combined, round);
        let map = map_from(&entries);
        comparisons += check(&map, &cases, "shuffled");
        maps += 1;
        for name in &cases {
            assert_eq!(base_reference(&map, name), base_reference(&combined_forward, name), "fieldBase order {name:?}");
            assert_eq!(ident_reference(&map, name), ident_reference(&combined_forward, name), "recordFieldIdent order {name:?}");
            comparisons += 2;
        }
    }

    // Single-entry maps: every keyword and every tricky field as a map hit.
    for keyword in RAW_KEYWORDS.iter().chain(UNRAWABLE_KEYWORDS.iter()) {
        let map = map_from(&[(*keyword, "single_hit")]);
        comparisons += check(&map, &cases, "single-keyword");
        maps += 1;
    }
    for name in &cases {
        let map = map_from(&[(name.as_str(), "single_hit")]);
        comparisons += check(&map, &cases, "single-field");
        maps += 1;
    }

    let delegations = fallback_probe(&cases, &collisions);
    assert_eq!(delegations, 0, "the native fast path consulted the oracle fallback");
    println!(
        "Native field names: {} fields / {} rename maps / {} comparisons passed; keyword and UTF-16 edges, collisions and insertion orders; no oracle fallback",
        cases.len(), maps, comparisons
    );
}
