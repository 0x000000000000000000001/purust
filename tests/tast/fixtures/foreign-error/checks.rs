use Purs_ForeignProbe::*;
use Purs_Foreign::ForeignError;
use Purs_Data_Ordering::Ordering::{LT, EQ, GT};
use purust_core::{Value, Func1, purust_string_from_utf8 as ps};
use std::rc::Rc;
fn msg(s: &str) -> Rc<ForeignError> { ForeignProbe_message(ps(s)) }
fn index(i: i64, e: Rc<ForeignError>) -> Rc<ForeignError> { ForeignProbe_atIndex(i, e) }
fn property(s: &str, e: Rc<ForeignError>) -> Rc<ForeignError> { ForeignProbe_atProperty(ps(s), e) }
fn four() -> Vec<Rc<ForeignError>> { vec![msg("bad"), ForeignProbe_mismatch("String".into(), "Number".into()), index(2, msg("bad")), property("é🙂", msg("bad"))] }
#[test]
fn constructors_and_patterns_are_native() {
    for (i, e) in four().iter().enumerate() { assert_eq!(ForeignProbe_tag(e.clone()), i as i64); }
    assert!(matches!(msg("bad").as_ref(), ForeignError::ForeignError(s) if s == "bad"));
    assert!(matches!(index(2, msg("bad")).as_ref(), ForeignError::ErrorAtIndex(2, e) if matches!(e.as_ref(), ForeignError::ForeignError(_))));
}
#[test]
fn renders_all_constructors() {
    let expected = ["bad", "Type mismatch: expected String, found Number", "Error at array index 2: bad", "Error at property \"é🙂\": bad"];
    for (e, s) in four().into_iter().zip(expected) { assert_eq!(ForeignProbe_render(e), ps(s)); }
}
#[test]
fn renders_nested_errors() {
    assert_eq!(ForeignProbe_render(property("item", index(-1, ForeignProbe_mismatch("X".into(), "Y".into())))),
        "Error at property \"item\": Error at array index -1: Type mismatch: expected X, found Y");
}
#[test]
fn show_dictionary() {
    let expected = ["(ForeignError \"bad\")", "(TypeMismatch \"String\" \"Number\")", "(ErrorAtIndex 2 (ForeignError \"bad\"))", "(ErrorAtProperty \"é🙂\" (ForeignError \"bad\"))"];
    for (e, s) in four().into_iter().zip(expected) { assert_eq!(ForeignProbe_display(e), ps(s)); }
}
#[test]
fn equality_dictionary() {
    for (i, a) in four().iter().enumerate() { for (j, b) in four().iter().enumerate() {
        assert_eq!(ForeignProbe_equal(a.clone(), b.clone()), i == j);
    } }
    assert!(!ForeignProbe_equal(property("x", index(2, msg("a"))), property("x", index(2, msg("b")))));
    assert!(!ForeignProbe_equal(index(1, msg("a")), index(2, msg("a"))));
}
#[test]
fn orders_constructor_tags() {
    for (i, a) in four().iter().enumerate() { for (j, b) in four().iter().enumerate() {
        let ord = ForeignProbe_order(a.clone(), b.clone());
        assert!(if i < j { matches!(ord, LT) } else if i > j { matches!(ord, GT) } else { matches!(ord, EQ) });
    } }
}
#[test]
fn orders_recursive_payloads() {
    assert!(matches!(ForeignProbe_order(index(1, msg("z")), index(2, msg("a"))), LT));
    assert!(matches!(ForeignProbe_order(property("x", msg("a")), property("x", msg("b"))), LT));
    assert!(matches!(ForeignProbe_order(msg("b"), msg("a")), GT));
}
#[test]
fn polymorphism_and_constructor_callback() {
    let error = property("x", msg("bad"));
    assert!(ForeignProbe_equal(ForeignProbe_polymorphic(error.clone()), error));
    assert_eq!(ForeignProbe_render(ForeignProbe_throughCallback(Func1::Static(ForeignProbe_message), "callback".into())), "callback");
}
#[test]
fn primitive_foreign_roundtrips() {
    for x in [i32::MIN as i64, 0, i32::MAX as i64] { assert_eq!(ForeignProbe_roundInt(x), x); }
    for x in ["", "é🙂"] { assert_eq!(ForeignProbe_roundString(ps(x)), ps(x)); }
}
#[test]
fn generic_foreign_preserves_values_and_handles() {
    assert_eq!(ForeignProbe_carrier(Value::Int(42)).unwrap_int(), 42);
    assert_eq!(ForeignProbe_carrier(Value::String("ok".into())).unwrap_string(), "ok");
    let array = Rc::new(vec![Value::Int(1)]);
    assert!(Rc::ptr_eq(&array, &ForeignProbe_carrier(Value::Array(array.clone())).unwrap_array()));
    let handle = Rc::new(String::from("opaque"));
    assert!(Rc::ptr_eq(&handle, ForeignProbe_carrier(Value::Class(Rc::new(handle.clone()))).unwrap_class::<Rc<String>>()));
}
