#![allow(warnings)]
// Differential test for the native ExprType renderer. The oracle is the real
// generated PureScript function `codegenExprTypeWithValueEnumsPure`; the
// candidate is the FFI source embedded through `// NATIVE_FFI`, exactly as the
// compiler build appends it. The production wrapper
// `codegenExprTypeWithValueEnums` is also exercised on every case.
use purust_core::*;
use std::sync::Arc as Rc;
use Purs_Data_Map_Internal::Map;
use Purs_Data_Maybe::Maybe;
use Purs_Data_Tuple::Tuple;
use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType;
use Purs_Data_Either::Either;
use Purs_Purust_CodeGen::{Purust_CodeGen_codegenExprTypeWithValueEnumsPure,
    Purust_CodeGen_codegenExprTypeWithValueEnums};
// NATIVE_FFI

fn tr_arc(ty: ExprType) -> Rc<ExprType> {
    Rc::new(ty)
}

fn tr_strings(values: &[&str]) -> Value {
    mk_array(values.iter().map(|value| Value::String(purust_string_from_utf8(value))).collect())
}

fn tr_types(values: Vec<Rc<ExprType>>) -> Value {
    mk_array(values.into_iter().map(|ty| Value::Class(Rc::new(ty))).collect())
}

fn tr_constraint(fqn: &[&str], args: Vec<Rc<ExprType>>) -> Value {
    Value::Class(Rc::new(Rc::new(Tuple::Tuple(tr_strings(fqn), tr_types(args)))))
}

fn tr_constraints(values: Vec<Value>) -> Value {
    mk_array(values)
}

fn tr_empty_enums() -> Rc<Map> {
    Rc::new(Map::Leaf)
}

fn tr_insert(enums: Rc<Map>, module: &str, name: &str) -> Rc<Map> {
    let ord = Purs_Data_Tuple::Data_Tuple_ordTuple(
        Purs_Data_Ord::Data_Ord_ordString(),
        Purs_Data_Ord::Data_Ord_ordString(),
    );
    let key = Value::Class(Rc::new(Rc::new(Tuple::Tuple(
        Value::String(purust_string_from_utf8(module)),
        Value::String(purust_string_from_utf8(name)),
    ))));
    Purs_Data_Set::Data_Set_insert(ord, key, enums)
}

fn tr_reference(enums: &Rc<Map>, module: &str, is_ret: bool, ty: &Rc<ExprType>) -> String {
    Purust_CodeGen_codegenExprTypeWithValueEnumsPure(
        enums.clone(),
        module.to_owned(),
        is_ret,
        ty.clone(),
    )
}

fn tr_native(enums: &Rc<Map>, module: &str, is_ret: bool, ty: &Rc<ExprType>) -> String {
    let fallback = Func4::Static(|_: Rc<Map>, _: String, _: bool, _: Rc<ExprType>| -> String {
        panic!("unexpected fallback")
    });
    Purust_CodeGen_codegenExprTypeWithValueEnumsImpl(
        fallback,
        enums.clone(),
        module.to_owned(),
        is_ret,
        ty.clone(),
    )
}

fn tr_production(enums: &Rc<Map>, module: &str, is_ret: bool, ty: &Rc<ExprType>) -> String {
    Purust_CodeGen_codegenExprTypeWithValueEnums(
        enums.clone(),
        module.to_owned(),
        is_ret,
        ty.clone(),
    )
}

fn tr_check(enums: &Rc<Map>, module: &str, is_ret: bool, ty: &Rc<ExprType>) -> usize {
    let expected = tr_reference(enums, module, is_ret, ty);
    let actual = tr_native(enums, module, is_ret, ty);
    assert_eq!(actual, expected, "native mismatch module={module:?} is_ret={is_ret} type={ty:p}");
    let wrapped = tr_production(enums, module, is_ret, ty);
    assert_eq!(wrapped, expected, "wrapper mismatch module={module:?} is_ret={is_ret} type={ty:p}");
    1
}

fn tr_read_lines(path: &str) -> Vec<String> {
    std::fs::read_to_string(path)
        .unwrap()
        .lines()
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect()
}

fn tr_layout_map(layouts: &str) -> Rc<Map> {
    let mut enums = tr_empty_enums();
    for line in tr_read_lines(layouts) {
        let (module, name) = line.split_once('\t').expect("module<TAB>name");
        enums = tr_insert(enums, module, name);
    }
    enums
}

fn tr_run_corpus(corpus: &str, layouts: &str) -> (usize, usize, usize) {
    let enums = tr_layout_map(layouts);
    let mut modules = 0;
    let mut types = 0;
    let mut checks = 0;
    for line in tr_read_lines(corpus) {
        let (module, table) = line.split_once('\t').expect("module<TAB>typeTable");
        let input = Purs_Data_Argonaut_Core::purust_json_parse_text(&purust_string_from_utf8(table))
            .expect("valid type table JSON");
        let decoded = Purs_PureScript_Backend_Optimizer_CoreFn_TypeTable::PureScript_Backend_Optimizer_CoreFn_TypeTable_decodeTypeTablePS(input);
        let Either::Right(rows) = decoded.as_ref() else {
            panic!("type table decode failed for {module}")
        };
        for index in 0..rows.array_len() {
            let ty = rows.array_get(index).unwrap_class::<Rc<ExprType>>().clone();
            checks += tr_check(&enums, module, false, &ty);
            checks += tr_check(&enums, module, true, &ty);
            checks += tr_check(&enums, "__other__", false, &ty);
            types += 1;
        }
        modules += 1;
    }
    (modules, types, checks)
}

fn tr_run_synthetic() -> usize {
    let mut enums = tr_empty_enums();
    for (module, name) in [
        ("M", "T"),
        ("M", "Empty"),
        ("M", "type"),
        ("M", "é😀"),
        ("M", "$opaque$Op"),
        ("Pipes_Internal", "X"),
        ("Data_Functor", "VariantF"),
        ("Other", "T"),
    ] {
        enums = tr_insert(enums, module, name);
    }
    let empty = tr_empty_enums();

    let mut cases: Vec<Rc<ExprType>> = vec![
        tr_arc(ExprType::Unit),
        tr_arc(ExprType::Int),
        tr_arc(ExprType::Number),
        tr_arc(ExprType::String),
        tr_arc(ExprType::Char),
        tr_arc(ExprType::Boolean),
        tr_arc(ExprType::Any),
        tr_arc(ExprType::TypeLevelString("sym".to_owned())),
        tr_arc(ExprType::TypeLevelString("λ".to_owned())),
        tr_arc(ExprType::TypeVar("a".to_owned())),
        tr_arc(ExprType::Array(tr_arc(ExprType::Int))),
        tr_arc(ExprType::Array(tr_arc(ExprType::TypeVar("a".to_owned())))),
        tr_arc(ExprType::Record(tr_arc(ExprType::Row(Value::Unit, Rc::new(Maybe::Nothing))))),
        tr_arc(ExprType::Row(Value::Unit, Rc::new(Maybe::Nothing))),
        tr_arc(ExprType::Row(tr_strings(&["a"]), Rc::new(Maybe::Just(Value::Int(1))))),
        tr_arc(ExprType::Row(Value::Int(0), Rc::new(Maybe::Nothing))),
    ];

    // ADT special cases, in the reference order.
    let adts: &[(&str, &[&str])] = &[
        ("T", &["M", "T"]),
        ("Empty", &["M", "Empty"]),
        ("Op", &["M", "Op"]),
        ("type", &["M", "type"]),
        ("é😀", &["M", "é😀"]),
        ("T", &["M"]),
        ("EmptyFqn", &[]),
        ("Void", &["M", "Void"]),
        ("X", &["Pipes", "Internal", "X"]),
        ("Type", &["Prim", "Type"]),
        ("Prim", &["Prim"]),
        ("Foo", &["PrimX", "Foo"]),
        ("Foo", &["Prim_", "Foo"]),
        ("Foo", &["Primitive", "Foo"]),
        ("Ref", &["Effect", "Ref"]),
        ("Ref", &["Effect"]),
        ("Exception", &["Effect", "Exception"]),
        ("Uncurried", &["Effect", "Uncurried"]),
        ("Console", &["Effect", "Console"]),
        ("Internal", &["Control_Monad_ST_Internal"]),
        ("ST", &["Data_Array_ST"]),
        ("Foreign", &["Foreign", "Foreign"]),
        ("ForeignError", &["Foreign", "ForeignError"]),
        ("Rejection", &["Promise_Rejection", "Rejection"]),
        ("Aff", &["Effect_Aff"]),
        ("AVar", &["Effect_Aff_AVar"]),
        ("Compat", &["Effect_Aff_Compat"]),
        ("Exists", &["Data_Exists", "Exists"]),
        ("VariantCase", &["Data_Variant_Internal", "VariantCase"]),
        ("VariantFCase", &["Data_Variant_Internal", "VariantFCase"]),
        ("Variant", &["Data_Variant", "Variant"]),
        ("VariantF", &["Data_Functor_Variant", "VariantF"]),
        ("Val", &["Control_Monad_Free", "Val"]),
        ("Fn2", &["Data_Function_Uncurried", "Fn2"]),
        ("Fn", &["Data_Function_Uncurried", "Fn"]),
        ("Foo", &["Data_Function_Uncurried", "Foo"]),
        ("STFn3", &["Control_Monad_ST_Uncurried", "STFn3"]),
        ("SFoo", &["Control_Monad_ST_Uncurried", "SFoo"]),
        ("VariantF", &["Data.Functor", "VariantF"]),
        ("En", &["M", "En", "Extra"]),
        ("Void", &["Void"]),
        ("X", &["Pipes_Internal", "X"]),
    ];
    for (class, fqn) in adts {
        cases.push(tr_arc(ExprType::ADT(
            (*class).to_owned(),
            tr_strings(fqn),
            mk_array(vec![]),
        )));
    }
    // Payloads the renderer legitimately ignores stay native.
    cases.push(tr_arc(ExprType::ADT("T".to_owned(), tr_strings(&["M", "T"]), Value::Int(0))));
    cases.push(tr_arc(ExprType::TypeApp(tr_arc(ExprType::Int), Value::Int(0))));
    cases.push(tr_arc(ExprType::ForAll(Value::Int(0), tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::Array(tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::Record(tr_arc(ExprType::Int))));

    // Function arities and nesting around the native arity bound.
    cases.push(tr_arc(ExprType::Func(mk_array(vec![]), tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::Func(tr_types(vec![tr_arc(ExprType::Int)]), tr_arc(ExprType::String))));
    cases.push(tr_arc(ExprType::Func(
        tr_types(vec![tr_arc(ExprType::Int); 12]),
        tr_arc(ExprType::Unit),
    )));
    cases.push(tr_arc(ExprType::Func(
        tr_types(vec![tr_arc(ExprType::Int); 13]),
        tr_arc(ExprType::Unit),
    )));
    cases.push(tr_arc(ExprType::Func(
        tr_types(vec![
            tr_arc(ExprType::ForAll(
                tr_strings(&["a"]),
                tr_arc(ExprType::Func(
                    tr_types(vec![tr_arc(ExprType::TypeVar("a".to_owned()))]),
                    tr_arc(ExprType::Array(tr_arc(ExprType::Int))),
                )),
            )),
            tr_arc(ExprType::ConstrainedType(
                tr_constraints(vec![tr_constraint(
                    &["Data", "Eq"],
                    vec![tr_arc(ExprType::TypeVar("a".to_owned()))],
                )]),
                tr_arc(ExprType::Int),
            )),
        ]),
        tr_arc(ExprType::String),
    )));

    // ForAll and TypeApp, including empty and malformed-ignored payloads.
    cases.push(tr_arc(ExprType::ForAll(tr_strings(&["a", "b"]), tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::ForAll(tr_strings(&[]), tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::ForAll(
        tr_strings(&["a"]),
        tr_arc(ExprType::Func(
            tr_types(vec![tr_arc(ExprType::TypeVar("a".to_owned()))]),
            tr_arc(ExprType::TypeVar("a".to_owned())),
        )),
    )));
    cases.push(tr_arc(ExprType::TypeApp(tr_arc(ExprType::TypeVar("f".to_owned())), tr_strings(&["a"]))));
    cases.push(tr_arc(ExprType::TypeApp(
        tr_arc(ExprType::ADT("T".to_owned(), tr_strings(&["M", "T"]), mk_array(vec![]))),
        tr_strings(&["a"]),
    )));
    cases.push(tr_arc(ExprType::TypeApp(
        tr_arc(ExprType::ForAll(tr_strings(&["a"]), tr_arc(ExprType::TypeVar("a".to_owned())))),
        tr_strings(&[]),
    )));

    // ConstrainedType composition with Func, Any, empty and dotted rows.
    cases.push(tr_arc(ExprType::ConstrainedType(tr_constraints(vec![]), tr_arc(ExprType::Int))));
    cases.push(tr_arc(ExprType::ConstrainedType(
        tr_constraints(vec![tr_constraint(&["Data", "Eq"], vec![])]),
        tr_arc(ExprType::Int),
    )));
    cases.push(tr_arc(ExprType::ConstrainedType(
        tr_constraints(vec![tr_constraint(&[], vec![])]),
        tr_arc(ExprType::TypeVar("a".to_owned())),
    )));
    cases.push(tr_arc(ExprType::ConstrainedType(
        tr_constraints(vec![tr_constraint(&["Data.Functor", "Functor"], vec![tr_arc(ExprType::TypeVar("f".to_owned()))])]),
        tr_arc(ExprType::Func(tr_types(vec![tr_arc(ExprType::Int)]), tr_arc(ExprType::Unit))),
    )));
    cases.push(tr_arc(ExprType::ConstrainedType(
        tr_constraints(vec![tr_constraint(&["C1"], vec![])]),
        tr_arc(ExprType::ConstrainedType(
            tr_constraints(vec![tr_constraint(&["C2"], vec![])]),
            tr_arc(ExprType::Func(tr_types(vec![tr_arc(ExprType::Int)]), tr_arc(ExprType::String))),
        )),
    )));

    let mut checks = 0;
    for ty in &cases {
        for module in ["M", "Other", "", "Data_Maybe"] {
            checks += tr_check(&enums, module, false, ty);
            checks += tr_check(&enums, module, true, ty);
            checks += tr_check(&empty, module, false, ty);
        }
    }
    checks
}

fn tr_run_delegations() -> usize {
    let cases: Vec<Rc<ExprType>> = vec![
        tr_arc(ExprType::Func(Value::Int(0), tr_arc(ExprType::Int))),
        tr_arc(ExprType::Func(mk_array(vec![Value::Int(0)]), tr_arc(ExprType::Int))),
        tr_arc(ExprType::ConstrainedType(Value::Int(0), tr_arc(ExprType::Int))),
        tr_arc(ExprType::ConstrainedType(mk_array(vec![Value::Int(0)]), tr_arc(ExprType::Int))),
        tr_arc(ExprType::ADT("T".to_owned(), Value::Int(0), Value::Unit)),
        tr_arc(ExprType::ADT("T".to_owned(), mk_array(vec![Value::Int(0)]), Value::Unit)),
        tr_arc(ExprType::ConstrainedType(
            mk_array(vec![Value::Class(Rc::new(Rc::new(Tuple::Tuple(Value::Int(0), mk_array(vec![]))))) ]),
            tr_arc(ExprType::Int),
        )),
    ];
    for ty in &cases {
        let fallback = Func4::Static(|_: Rc<Map>, _: String, _: bool, _: Rc<ExprType>| -> String {
            "DELEGATED".to_owned()
        });
        let actual = Purust_CodeGen_codegenExprTypeWithValueEnumsImpl(
            fallback,
            tr_empty_enums(),
            "M".to_owned(),
            false,
            ty.clone(),
        );
        assert_eq!(actual, "DELEGATED", "shape should delegate: {ty:p}");
    }
    cases.len()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    assert_eq!(args.len(), 3, "Usage: purust_native_type_render_test CORPUS_NDJSON LAYOUTS_NDJSON");
    let synthetic = tr_run_synthetic();
    let (modules, types, corpus_checks) = tr_run_corpus(&args[1], &args[2]);
    let delegations = tr_run_delegations();
    println!(
        "Native type render: {modules} corpus modules / {types} corpus types / {synthetic} synthetic checks / {corpus_checks} corpus checks / {delegations} delegation probes passed"
    );
}
