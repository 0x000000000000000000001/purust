use Purs_RecordKeywordProbe::*;

#[test]
fn distinct_fields_borrow_and_update_preserve_original() {
    let original = RecordKeywordProbe_make(7, 11);
    assert_eq!(RecordKeywordProbe_readFinal(original.clone()), 7);
    assert_eq!(RecordKeywordProbe_readOther(original.clone()), 11);
    let changed = RecordKeywordProbe_replaceFinal(19, original.clone());
    assert_eq!(RecordKeywordProbe_readFinal(changed.clone()), 19);
    assert_eq!(RecordKeywordProbe_readOther(changed), 11);
    assert_eq!(RecordKeywordProbe_readFinal(original), 7);
}

#[test]
fn legacy_record_uses_the_same_fields_and_logical_keys() {
    let mut value = purust_core::Value::Record_a(perceus_ptr::PerceusPtr::new(purust_core::Record_a {
        r#final: Some(purust_core::mk_int(7)),
        final_kw: Some(purust_core::mk_int(11)),
        ..Default::default()
    }));
    let original = value.clone();
    assert_eq!(value.get_final().unwrap_int(), 7);
    assert_eq!(value.__purust_borrow_final().unwrap_int(), 7);
    value.set_final(purust_core::mk_int(19));
    assert_eq!(value.__purust_get_field("final").unwrap().unwrap_int(), 19);
    assert!(value.__purust_get_field("r#final").is_none());
    let changed = RecordKeywordProbe_replaceDynamic("final".into(), 23, value);
    assert_eq!(RecordKeywordProbe_readFinal(changed.clone()), 23);
    assert_eq!(RecordKeywordProbe_readOther(changed), 11);
    assert_eq!(RecordKeywordProbe_readFinal(original), 7);
}

#[test]
fn dynamic_keys_keep_the_purescript_spelling() {
    let original = RecordKeywordProbe_make(7, 11);
    assert_eq!(RecordKeywordProbe_readDynamic("final".into(), original.clone()), 7);
    assert_eq!(RecordKeywordProbe_readDynamic("final_kw".into(), original.clone()), 11);
    let changed = RecordKeywordProbe_replaceDynamic("final".into(), 23, original.clone());
    assert_eq!(RecordKeywordProbe_readFinal(changed.clone()), 23);
    assert_eq!(RecordKeywordProbe_readOther(changed), 11);
    let changed = RecordKeywordProbe_replaceDynamic("final_kw".into(), 29, original.clone());
    assert_eq!(RecordKeywordProbe_readFinal(changed.clone()), 7);
    assert_eq!(RecordKeywordProbe_readOther(changed), 29);
    let widened = original.clone().__purust_set_field("unseen".into(), purust_core::mk_int(31));
    assert_eq!(RecordKeywordProbe_readDynamic("final".into(), widened.clone()), 7);
    assert_eq!(RecordKeywordProbe_readDynamic("final_kw".into(), widened.clone()), 11);
    assert_eq!(RecordKeywordProbe_readDynamic("unseen".into(), widened), 31);
    assert_eq!(RecordKeywordProbe_readFinal(original), 7);
}

// `self` cannot be a Rust identifier nor r#self, so the native field is
// self_kw while the logical label and its dynamic key stay "self".
#[test]
fn self_field_is_renamed_at_the_native_field_site() {
    let original = RecordKeywordProbe_makeSelf(5, 13);
    assert_eq!(RecordKeywordProbe_readSelf(original.clone()), 5);
    assert_eq!(RecordKeywordProbe_readSelfOther(original.clone()), 13);
    let changed = RecordKeywordProbe_replaceSelf(23, original.clone());
    assert_eq!(RecordKeywordProbe_readSelf(changed.clone()), 23);
    assert_eq!(RecordKeywordProbe_readSelfOther(changed), 13);
    assert_eq!(RecordKeywordProbe_readSelf(original), 5);
}

#[test]
fn self_field_keeps_the_logical_dynamic_key() {
    let mut value = purust_core::Value::Record_other_self_kw(perceus_ptr::PerceusPtr::new(purust_core::Record_other_self_kw {
        self_kw: Some(purust_core::mk_int(7)),
        other: Some(purust_core::mk_int(11)),
        ..Default::default()
    }));
    assert_eq!(value.get_self_kw().unwrap_int(), 7);
    assert_eq!(value.__purust_borrow_self_kw().unwrap_int(), 7);
    assert_eq!(value.__purust_get_field("self").unwrap().unwrap_int(), 7);
    assert!(value.__purust_get_field("self_kw").is_none());
    value.set_self_kw(purust_core::mk_int(19));
    assert_eq!(value.get_self_kw().unwrap_int(), 19);
    let replaced = RecordKeywordProbe_replaceSelfDynamic("self".into(), 29, value.clone());
    assert_eq!(RecordKeywordProbe_readSelf(replaced), 29);
    let widened = RecordKeywordProbe_replaceSelfDynamic("other".into(), 31, value);
    assert_eq!(RecordKeywordProbe_readSelfOther(widened), 31);
}

#[test]
fn self_dynamic_keys_keep_the_purescript_spelling() {
    let original = RecordKeywordProbe_makeSelf(5, 13);
    assert_eq!(RecordKeywordProbe_readSelfDynamic("self".into(), original.clone()), 5);
    assert_eq!(RecordKeywordProbe_readSelfDynamic("other".into(), original.clone()), 13);
    let changed = RecordKeywordProbe_replaceSelfDynamic("self".into(), 23, original);
    assert_eq!(RecordKeywordProbe_readSelf(changed), 23);
}

// A keyword and its literal *_kw twin share one record. The compilation-wide
// rename map must keep their fields, methods and dynamic keys distinct.
#[test]
fn keyword_and_twin_fields_get_distinct_rust_names() {
    let original = RecordKeywordProbe_makeCollision(5, 13);
    assert_eq!(RecordKeywordProbe_readGen(original.clone()), 5);
    assert_eq!(RecordKeywordProbe_readGenKw(original.clone()), 13);
    let changed = RecordKeywordProbe_replaceGen(23, original.clone());
    assert_eq!(RecordKeywordProbe_readGen(changed.clone()), 23);
    assert_eq!(RecordKeywordProbe_readGenKw(changed), 13);
    assert_eq!(RecordKeywordProbe_readGen(original), 5);
}

#[test]
fn collision_fields_keep_the_purescript_dynamic_keys() {
    let mut value = purust_core::Value::Record_gen_kw_gen_kw_1(perceus_ptr::PerceusPtr::new(purust_core::Record_gen_kw_gen_kw_1 {
        gen_kw: Some(purust_core::mk_int(7)),
        gen_kw_1: Some(purust_core::mk_int(11)),
        ..Default::default()
    }));
    assert_eq!(value.get_gen_kw().unwrap_int(), 7);
    assert_eq!(value.get_gen_kw_1().unwrap_int(), 11);
    assert_eq!(value.__purust_get_field("gen").unwrap().unwrap_int(), 7);
    assert_eq!(value.__purust_get_field("gen_kw").unwrap().unwrap_int(), 11);
    value.set_gen_kw(purust_core::mk_int(19));
    assert_eq!(value.get_gen_kw().unwrap_int(), 19);
    assert_eq!(value.get_gen_kw_1().unwrap_int(), 11);
    let changed = RecordKeywordProbe_replaceDynamic("gen_kw".into(), 29, value);
    assert_eq!(RecordKeywordProbe_readGenKw(changed), 29);
}

// Numeric labels cannot start a Rust identifier, so the native field gains a
// leading underscore while the logical label and dynamic key stay "01"/"2".
#[test]
fn numeric_fields_get_valid_rust_names() {
    let original = RecordKeywordProbe_makeNumeric(5, 13, 18);
    assert_eq!(RecordKeywordProbe_readNumeric01(original.clone()), 5);
    assert_eq!(RecordKeywordProbe_readNumeric2(original.clone()), 13);
    assert_eq!(RecordKeywordProbe_readNumericOther(original.clone()), 18);
    let changed = RecordKeywordProbe_replaceNumeric01(23, original.clone());
    assert_eq!(RecordKeywordProbe_readNumeric01(changed.clone()), 23);
    assert_eq!(RecordKeywordProbe_readNumeric2(changed.clone()), 13);
    assert_eq!(RecordKeywordProbe_readNumericOther(changed), 18);
    assert_eq!(RecordKeywordProbe_readNumeric01(original), 5);
}

#[test]
fn numeric_dynamic_keys_keep_the_purescript_spelling() {
    let mut value = purust_core::Value::Record__01__2_other(perceus_ptr::PerceusPtr::new(purust_core::Record__01__2_other {
        _01: Some(purust_core::mk_int(7)),
        _2: Some(purust_core::mk_int(11)),
        other: Some(purust_core::mk_int(13)),
        ..Default::default()
    }));
    assert_eq!(value.get__01().unwrap_int(), 7);
    assert_eq!(value.__purust_borrow__01().unwrap_int(), 7);
    assert_eq!(value.get__2().unwrap_int(), 11);
    assert_eq!(value.__purust_get_field("01").unwrap().unwrap_int(), 7);
    assert_eq!(value.__purust_get_field("2").unwrap().unwrap_int(), 11);
    assert!(value.__purust_get_field("_01").is_none());
    value.set__01(purust_core::mk_int(19));
    assert_eq!(value.get__01().unwrap_int(), 19);
    let original = RecordKeywordProbe_makeNumeric(5, 13, 18);
    assert_eq!(RecordKeywordProbe_readNumericDynamic("01".into(), original.clone()), 5);
    assert_eq!(RecordKeywordProbe_readNumericDynamic("2".into(), original.clone()), 13);
    let changed = RecordKeywordProbe_replaceNumericDynamic("01".into(), 23, original);
    assert_eq!(RecordKeywordProbe_readNumeric01(changed), 23);
}
