#![allow(warnings)]
use purust_core::*;
use std::sync::Arc;
use Purs_Data_Map_Internal::Map;
use Purs_Data_Tuple::Tuple;
use Purs_Data_Maybe::Maybe;
use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType as T;
use Purs_Purust_CodeGen as codegen;

fn box_type(t: Arc<T>) -> Value { Value::Class(Arc::new(t)) }
fn types(ts: Vec<Arc<T>>) -> Value { mk_array(ts.into_iter().map(box_type).collect()) }
fn strings(xs: &[&str]) -> Value { mk_array(xs.iter().map(|s| Value::String(purust_string_from_utf8(s))).collect()) }
fn adt(module: &str, name: &str) -> Arc<T> { Arc::new(T::ADT(name.into(), strings(&[module, name]), mk_array(vec![]))) }
fn func(args: Vec<Arc<T>>, ret: Arc<T>) -> Arc<T> { Arc::new(T::Func(types(args), ret)) }
fn empty() -> Arc<Map> { Arc::new(Map::Leaf) }

fn check(expected: &Arc<T>, actual: &Arc<T>, text: &str, fields: Arc<Map>, strict: bool) {
    let code = purust_string_from_utf8(text);
    let reference = codegen::Purust_CodeGen_boxUnboxReference(empty(), empty(), fields.clone(), "M".into(), expected.clone(), actual.clone(), code.clone());
    let fallback = if strict {
        Func7::Static(|_: Arc<Map>, _: Arc<Map>, _: Arc<Map>, _: String, _: Arc<T>, _: Arc<T>, _: String| -> String {
            panic!("simple coercion unexpectedly delegated")
        })
    } else { Func7::Static(codegen::Purust_CodeGen_boxUnboxReference) };
    let native = codegen::Purust_CodeGen_boxUnboxImpl(fallback, empty(), empty(), fields.clone(), "M".into(), expected.clone(), actual.clone(), code.clone());
    let wrapped = codegen::Purust_CodeGen_boxUnbox(empty(), empty(), fields, "M".into(), expected.clone(), actual.clone(), code);
    assert_eq!(native, reference, "native source={text:?}");
    assert_eq!(wrapped, reference, "wrapper source={text:?}");
}

fn main() {
    let any = Arc::new(T::Any); let int = Arc::new(T::Int);
    let primitives = vec![any.clone(), int.clone(), Arc::new(T::Number), Arc::new(T::String),
        Arc::new(T::Boolean), Arc::new(T::Char), Arc::new(T::Unit), Arc::new(T::TypeVar("a".into())),
        Arc::new(T::TypeLevelString("label".into())), Arc::new(T::Array(any.clone())),
        Arc::new(T::Record(Arc::new(T::Row(mk_array(vec![]), Arc::new(Maybe::Nothing))))),
        Arc::new(T::ForAll(strings(&["a"]), int.clone())), Arc::new(T::TypeApp(int.clone(), types(vec![any.clone()])))];
    let snippets = ["x", "", "(x + y)", "unimplemented!()", "unimplemented!(); anything",
        "/* Typed Int */ unimplemented!()", "/* Typed Int */ unimplemented!()\nother",
        "continue;\n    }", "loop { continue;\n    }", "continue;\n   }", "é😀τ", "{\n    call();\n    x\n}"];
    let mut checks = 0;
    for expected in &primitives { for actual in &primitives { for text in snippets {
        check(expected, actual, text, empty(), true); checks += 1;
    } } }
    let functions = vec![func(vec![], int.clone()), func(vec![int.clone()], int.clone()),
        func(vec![any.clone()], any.clone()), func(vec![int.clone(), any.clone()], int.clone()),
        func(vec![any.clone(); 12], any.clone()), func(vec![any.clone(); 13], any.clone()),
        Arc::new(T::ConstrainedType(mk_array(vec![]), int.clone()))];
    let mut delegations = 0;
    for function in &functions { for other in [&any, &int, &functions[1]] {
        check(function, other, "f", empty(), false); check(other, function, "f", empty(), false); delegations += 2;
    } }
    for ty in [adt("M", "D"), adt("Foreign.Object", "Object"), adt("Prim", "Int"), adt("Effect", "Effect")] {
        check(&any, &ty, "dictionary", empty(), false); check(&ty, &any, "dictionary", empty(), false);
        check(&ty, &int, "x", empty(), false); check(&int, &ty, "x", empty(), false); delegations += 4;
    }
    let field = Value::Class(Arc::new(Arc::new(Tuple::Tuple(Value::String("value".into()), box_type(int.clone())))));
    let fields = Purs_Data_Map_Internal::Data_Map_Internal_insert(Purs_Data_Ord::Data_Ord_ordString(),
        Value::String("M_D".into()), mk_array(vec![field]), empty());
    check(&any, &adt("M", "D"), "dictionary", fields.clone(), false);
    check(&adt("M", "D"), &any, "dictionary", fields, false); delegations += 2;
    // Equal representations must return the original owned buffer, even for a
    // large body. This catches reintroduction of the copying path itself.
    let big = "body\n".repeat(200_000); let pointer = big.as_ptr();
    let result = codegen::Purust_CodeGen_boxUnboxImpl(Func7::Static(codegen::Purust_CodeGen_boxUnboxReference),
        empty(), empty(), empty(), "M".into(), int.clone(), int, big);
    assert_eq!(result.as_ptr(), pointer);
    println!("Native box/unbox: {checks} exact primitive/guard pairs / {delegations} function and ADT cases / large-buffer ownership passed");
}
