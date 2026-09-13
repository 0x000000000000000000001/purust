use Purs_VariantProbe::*;
use Purs_Data_Ordering::Ordering::{LT, EQ, GT};
use purust_core::Value;
use std::rc::Rc;

#[test]
fn integer_equality() {
    for (a, b) in [(i32::MIN as i64, i32::MIN as i64), (i32::MAX as i64, i32::MAX as i64), (-1, 1), (0, 0)] {
        assert_eq!(VariantProbe_equalInts(a, b), a == b);
    }
}
#[test]
fn string_equality() {
    for (a, b) in [("", ""), ("é🙂", "é🙂"), ("a", "b")] {
        assert_eq!(VariantProbe_equalStrings(a.into(), b.into()), a == b);
    }
}
#[test]
fn mixed_tags_differ() { assert!(!VariantProbe_differentTags(1, "1".into())); }
#[test]
fn integer_ordering() {
    assert!(matches!(VariantProbe_compareInts(-1, 2), LT));
    assert!(matches!(VariantProbe_compareInts(3, -1), GT));
    assert!(matches!(VariantProbe_compareInts(0, 0), EQ));
}
#[test]
fn string_ordering() {
    assert!(matches!(VariantProbe_compareStrings("a".into(), "b".into()), LT));
    assert!(matches!(VariantProbe_compareStrings("b".into(), "a".into()), GT));
    assert!(matches!(VariantProbe_compareStrings("é🙂".into(), "é🙂".into()), EQ));
}
#[test]
fn tag_ordering() { assert!(matches!(VariantProbe_compareDifferentTags(999, "0".into()), LT)); }
#[test]
fn mismatched_tags_skip_callbacks() {
    assert!(!VariantProbe_differentTagsWithoutCallbacks(1, "1".into()));
    assert!(matches!(VariantProbe_orderedTagsWithoutCallbacks(1, "1".into()), LT));
}
#[test]
#[should_panic(expected = "Data.Variant: impossible `eq`")]
fn missing_equality_callback_throws() { VariantProbe_missingEq(1, 1); }
#[test]
#[should_panic(expected = "Data.Variant: impossible `compare`")]
fn missing_ordering_callback_throws() { VariantProbe_missingOrd(1, 1); }
#[test]
fn carrier_preserves_payloads_and_handles() {
    assert_eq!(VariantProbe_rep("int".into(), Value::Int(42)).get_value().unwrap_int(), 42);
    assert_eq!(VariantProbe_rep("text".into(), Value::String("ok".into())).get_value().unwrap_string(), "ok");
    let array = Rc::new(vec![Value::Int(1)]);
    let rep = VariantProbe_rep("array".into(), Value::Array(array.clone()));
    assert!(Rc::ptr_eq(&array, &rep.get_value().unwrap_array()));
    let handle = Rc::new(String::from("opaque native payload"));
    let rep = VariantProbe_rep("object".into(), Value::Class(Rc::new(handle.clone())));
    assert!(Rc::ptr_eq(&handle, rep.get_value().unwrap_class::<Rc<String>>()));
    assert_eq!(rep.get_type_kw().unwrap_string(), "object");
}
