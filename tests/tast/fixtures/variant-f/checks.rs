use Purs_VariantFProbe::*;

#[test]
fn variant_f_payload_mapper_and_record_literal() {
    assert_eq!(VariantFProbe_original(), 41);
    assert_eq!(VariantFProbe_mapped(), 42);
    assert_eq!(VariantFProbe_original(), 41);
    assert_eq!(VariantFProbe_emptyMapped(), 0);
    assert_eq!(VariantFProbe_changedType(), "41");
    assert_eq!(VariantFProbe_recordMapped(), 42);
    match VariantFProbe_traversed().as_ref() {
        Purs_Data_Maybe::Maybe::Just(value) => assert_eq!(value.unwrap_int(), 42),
        _ => panic!("expected Just after traversal"),
    }
}
