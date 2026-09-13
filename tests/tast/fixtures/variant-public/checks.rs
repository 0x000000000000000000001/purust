use Purs_VariantPublicProbe::*;
use Purs_Data_Ordering::Ordering::{LT, EQ, GT};
use purust_core::{Value, Func1, purust_string_from_utf8 as ps};
use std::rc::Rc;
fn int(n: i64) -> Value { VariantPublicProbe_integer(n) }
fn text(s: &str) -> Value { VariantPublicProbe_text(ps(s)) }
#[test]
fn injection_keeps_record_tag_and_payload() {
    let x = int(7); assert_eq!(x.get_type_kw().unwrap_string(), "integer"); assert_eq!(x.get_value().unwrap_int(), 7);
    let x = text("é🙂"); assert_eq!(x.get_type_kw().unwrap_string(), "text"); assert_eq!(x.get_value().unwrap_string(), ps("é🙂"));
}
#[test]
fn projection_checks_tag() { assert_eq!(VariantPublicProbe_project(int(-5)), -5); assert_eq!(VariantPublicProbe_project(text("x")), -999); }
#[test]
fn match_dispatches_record_callbacks() {
    assert_eq!(VariantPublicProbe_describe(int(7)), "int:7"); assert_eq!(VariantPublicProbe_describe(text("é🙂")), ps("text:é🙂"));
}
#[test]
fn on_skips_unselected_callback() {
    assert_eq!(VariantPublicProbe_onlyInteger(Func1::Static(|n| format!("callback:{n}")), int(8)), "callback:8");
    assert_eq!(VariantPublicProbe_onlyInteger(Func1::Static(|_| panic!("must skip")), text("x")), "skip");
}
#[test]
fn over_maps_only_selected_tag() {
    assert_eq!(VariantPublicProbe_project(VariantPublicProbe_increment(int(7))), 8);
    assert_eq!(VariantPublicProbe_describe(VariantPublicProbe_increment(text("x"))), "text:x");
}
#[test]
fn expand_preserves_value() { assert_eq!(VariantPublicProbe_project(VariantPublicProbe_expanded(9)), 9); }
#[test]
fn contract_accepts_only_member_tags() { assert_eq!(VariantPublicProbe_contracted(int(9)), 9); assert_eq!(VariantPublicProbe_contracted(text("x")), -999); }
#[test]
fn equality_uses_tags_and_payload_dictionaries() {
    assert!(VariantPublicProbe_equal(int(1), int(1))); assert!(!VariantPublicProbe_equal(int(1), int(2)));
    assert!(!VariantPublicProbe_equal(int(1), text("1"))); assert!(VariantPublicProbe_equal(text("é🙂"), text("é🙂")));
}
#[test]
fn ordering_uses_tags_and_payload_dictionaries() {
    assert!(matches!(VariantPublicProbe_order(int(1), int(2)), LT)); assert!(matches!(VariantPublicProbe_order(text("b"), text("a")), GT));
    assert!(matches!(VariantPublicProbe_order(int(99), text("0")), LT)); assert!(matches!(VariantPublicProbe_order(text("same"), text("same")), EQ));
}
#[test]
fn show_preserves_unicode_payload() {
    assert_eq!(VariantPublicProbe_display(int(7)), "(inj @\"integer\" 7)");
    assert_eq!(VariantPublicProbe_display(text("é🙂")), ps("(inj @\"text\" \"é🙂\")"));
}
#[test]
fn generic_payload_preserves_handles() {
    assert_eq!(VariantPublicProbe_generic(Value::Int(42)).get_value().unwrap_int(), 42);
    let array = Rc::new(vec![Value::Int(1)]);
    assert!(Rc::ptr_eq(&array, &VariantPublicProbe_generic(Value::Array(array.clone())).get_value().unwrap_array()));
    let handle = Rc::new(String::from("opaque"));
    let value = VariantPublicProbe_generic(Value::Class(Rc::new(handle.clone()))).get_value();
    assert!(Rc::ptr_eq(&handle, value.unwrap_class::<Rc<String>>()));
}
#[test]
#[should_panic(expected = "Data.Variant: pattern match failure [missing]")]
fn impossible_empty_variant_throws() { VariantPublicProbe_rejectUnknown(()); }
