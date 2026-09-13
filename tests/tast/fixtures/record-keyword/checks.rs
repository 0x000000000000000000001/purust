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
