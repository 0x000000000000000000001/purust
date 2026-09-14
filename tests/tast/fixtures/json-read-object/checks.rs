use Purs_Data_Either::Either;
use Purs_Foreign_Object::Object;
use Purs_JsonReadObjectProbe::*;
use purust_core::{Value, mk_int, mk_string};
use std::rc::Rc;

fn native(entries: Vec<(&str, Value)>) -> Rc<Object> {
    Rc::new(Object::from_entries(
        entries.into_iter().map(|(k, v)| (k.into(), v)).collect(),
    ))
}
fn boxed(object: Rc<Object>) -> Value {
    Value::Class(Rc::new(object))
}
fn right(result: Rc<Either>) -> Value {
    match result.as_ref() {
        Either::Right(value) => value.clone(),
        Either::Left(_) => panic!("unexpected JSON decoding failure"),
    }
}
fn object(result: Rc<Either>) -> Rc<Object> {
    right(result).unwrap_class::<Rc<Object>>().clone()
}
fn keys(object: &Rc<Object>) -> Vec<String> {
    object.entries().into_iter().map(|(key, _)| key).collect()
}
fn event(result: Rc<Either>) -> i64 {
    JsonReadObjectProbe_taggedValue(right(result).unwrap_class::<Rc<Tagged>>().clone())
}

#[test]
fn native_object_identity_is_preserved_by_the_cast() {
    let original = native(vec![("value", mk_int(42))]);
    assert!(Rc::ptr_eq(
        &original,
        &JsonReadObjectProbe_asObject(boxed(original.clone()))
    ));
    assert!(Rc::ptr_eq(
        &original,
        &JsonReadObjectProbe_roundObject(original.clone())
    ));
}

#[test]
fn ps_record_to_object_cast_preserves_properties() {
    let record = JsonReadObjectProbe_recordForeign(42);
    assert!(
        record.__purust_record_fields().is_some(),
        "this test must start with a PS record carrier"
    );
    let result = JsonReadObjectProbe_asObject(record);
    assert_eq!(keys(&result), ["type", "value"]);
    assert_eq!(result.get("type").unwrap().unwrap_string(), "RaisedInt");
    assert_eq!(result.get("value").unwrap().unwrap_int(), 42);
}

#[test]
fn yoga_read_foreign_object_accepts_ps_record() {
    let result = object(JsonReadObjectProbe_readRecordObject(42));
    assert_eq!(keys(&result), ["type", "value"]);
    assert_eq!(result.get("type").unwrap().unwrap_string(), "RaisedInt");
    assert_eq!(result.get("value").unwrap().unwrap_int(), 42);
}

#[test]
fn yoga_read_foreign_object_accepts_native_object() {
    let original = native(vec![
        ("type", mk_string("RaisedInt")),
        ("value", mk_int(42)),
    ]);
    let result = object(JsonReadObjectProbe_readObject(boxed(original.clone())));
    assert_eq!(keys(&result), ["type", "value"]);
    assert_eq!(result.get("value").unwrap().unwrap_int(), 42);
    assert!(
        !Rc::ptr_eq(&original, &result),
        "ReadForeign Object maps its fields into a new Object in JS"
    );
}

#[test]
fn tagged_sum_decoder_accepts_ps_record() {
    assert_eq!(event(JsonReadObjectProbe_decodeRecord(42)), 42);
}

#[test]
fn tagged_sum_decoder_accepts_json_native_object() {
    assert_eq!(
        event(JsonReadObjectProbe_decodeJSON(
            r#"{"type":"RaisedInt","value":42}"#.into()
        )),
        42
    );
    assert_eq!(
        event(JsonReadObjectProbe_decodeJSON(
            r#"{"type":"RaisedRecord","value":{"count":43}}"#.into()
        )),
        43
    );
}

#[test]
fn nested_ps_records_are_read_as_objects() {
    let result = object(JsonReadObjectProbe_readNestedObjects(
        JsonReadObjectProbe_nestedRecordForeign(42),
    ));
    assert_eq!(keys(&result), ["first", "second"]);
    for (key, expected) in [("first", 42), ("second", 43)] {
        let child = result.get(key).unwrap();
        assert_eq!(
            child
                .unwrap_class::<Rc<Object>>()
                .get("count")
                .unwrap()
                .unwrap_int(),
            expected
        );
    }
}

#[test]
fn own_property_order_matches_javascript() {
    let result = JsonReadObjectProbe_asObject(JsonReadObjectProbe_orderedRecordForeign(42));
    assert_eq!(keys(&result), EXPECTED_RECORD_KEYS);
    assert_eq!(result.get("constructor").unwrap().unwrap_int(), 42);
}

#[test]
fn dynamic_and_native_numeric_property_order_matches_javascript() {
    let original = native(vec![
        ("z", mk_int(42)),
        ("10", mk_int(10)),
        ("2", mk_int(2)),
        ("01", mk_int(1)),
        ("__proto__", Value::Null),
    ]);
    let mut fields = purust_core::RecordFields::new();
    for (key, value) in original.entries() {
        fields.insert(key, value);
    }
    let dynamic = Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields));
    assert_eq!(
        keys(&JsonReadObjectProbe_asObject(dynamic)),
        ["2", "10", "z", "01", "__proto__"]
    );
    assert_eq!(
        keys(&JsonReadObjectProbe_asObject(boxed(original))),
        ["2", "10", "z", "01", "__proto__"]
    );
}

#[test]
fn to_array_with_key_preserves_values_and_javascript_key_order() {
    let child = native(vec![("count", mk_int(42))]);
    let original = native(vec![
        ("z", Value::Unit),
        ("10", mk_int(10)),
        ("2", mk_int(2)),
        ("01", mk_int(1)),
        ("__proto__", boxed(child.clone())),
        ("constructor", Value::Null),
    ]);
    let result = Purs_Foreign_Object::Foreign_Object_toArrayWithKey(
        purust_core::Func2::Static(|key, value| {
            purust_core::mk_array(vec![Value::String(key), value])
        }),
        original,
    )
    .unwrap_array();
    let actual_keys: Vec<String> = result
        .iter()
        .map(|v| v.unwrap_array()[0].unwrap_string())
        .collect();
    assert_eq!(actual_keys, EXPECTED_NATIVE_KEYS);
    assert!(matches!(result[2].unwrap_array()[1], Value::Unit));
    assert!(matches!(result[5].unwrap_array()[1], Value::Null));
    assert!(Rc::ptr_eq(
        &child,
        result[4].unwrap_array()[1].unwrap_class::<Rc<Object>>()
    ));
}

#[test]
fn to_array_with_key_reads_updated_values_and_skips_deleted_keys() {
    let original = native(vec![("a", mk_int(1)), ("b", mk_int(2)), ("c", mk_int(3))]);
    let callback_object = original.clone();
    let result = Purs_Foreign_Object::Foreign_Object_toArrayWithKey(
        purust_core::Func2::Shared(Rc::new(move |key, value: Value| {
            if key == "a" {
                callback_object.insert("b".into(), mk_int(20));
                callback_object.remove("c");
                callback_object.insert("d".into(), mk_int(4));
            }
            mk_string(&format!("{key}:{}", value.unwrap_int()))
        })),
        original.clone(),
    )
    .unwrap_array();
    assert_eq!(
        result.iter().map(Value::unwrap_string).collect::<Vec<_>>(),
        EXPECTED_MUTATION
    );
    assert_eq!(original.get("b").unwrap().unwrap_int(), 20);
    assert_eq!(original.get("d").unwrap().unwrap_int(), 4);
    assert!(original.get("c").is_none());
}

#[test]
fn to_array_with_key_empty_and_utf16_are_lossless() {
    let empty = Purs_Foreign_Object::Foreign_Object_toArrayWithKey(
        purust_core::Func2::Static(|_, _| panic!("empty object callback must not execute")),
        native(vec![]),
    );
    assert!(empty.unwrap_array().is_empty());
    let key = purust_core::purust_string_from_utf16(&[0xd800]);
    let value = purust_core::purust_string_from_utf16(&[0xdc00, 0x61]);
    let result = Purs_Foreign_Object::Foreign_Object_toArrayWithKey(
        purust_core::Func2::Static(|key, value| {
            purust_core::mk_array(vec![Value::String(key), value])
        }),
        Rc::new(Object::from_entries(vec![(key, Value::String(value))])),
    )
    .unwrap_array();
    let pair = result[0].unwrap_array();
    assert_eq!(
        purust_core::purust_string_to_utf16(&pair[0].unwrap_string()),
        [0xd800]
    );
    assert_eq!(
        purust_core::purust_string_to_utf16(&pair[1].unwrap_string()),
        [0xdc00, 0x61]
    );
}

#[test]
fn to_array_with_key_preserves_effect_exception_identity_and_stops() {
    use Purs_Effect_Exception::*;
    let error = Effect_Exception_errorWithName("callback failed".into(), "TypeError".into());
    let raised = error.clone();
    let calls = Rc::new(std::sync::atomic::AtomicUsize::new(0));
    let observed = calls.clone();
    let result = purust_exception_try(|| {
        Purs_Foreign_Object::Foreign_Object_toArrayWithKey(
            purust_core::Func2::Shared(Rc::new(move |_, _| {
                observed.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                purust_exception_raise(raised.clone())
            })),
            native(vec![("a", mk_int(1)), ("b", mk_int(2))]),
        )
    });
    let caught = match result {
        Err(error) => error,
        Ok(_) => panic!("callback error was swallowed"),
    };
    assert!(std::sync::Arc::ptr_eq(
        &purust_exception_unbox(&error),
        &purust_exception_unbox(&caught)
    ));
    assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
}

#[test]
fn nested_native_identity_and_record_copy_semantics_are_preserved() {
    let child = native(vec![("count", mk_int(42))]);
    let mut fields = purust_core::RecordFields::new();
    fields.insert("child".into(), boxed(child.clone()));
    let record = Value::DynamicRecord(perceus_ptr::PerceusPtr::new(fields));
    let converted = JsonReadObjectProbe_asObject(record.clone());
    assert!(Rc::ptr_eq(
        &child,
        converted.get("child").unwrap().unwrap_class::<Rc<Object>>()
    ));
    converted.insert("added".into(), mk_int(9));
    assert!(
        record
            .__purust_record_fields()
            .unwrap()
            .get("added")
            .is_none(),
        "immutable PS record must not be mutated"
    );
    let decoded = object(JsonReadObjectProbe_readObject(boxed(converted)));
    assert!(Rc::ptr_eq(
        &child,
        decoded.get("child").unwrap().unwrap_class::<Rc<Object>>()
    ));
}

#[test]
fn native_object_fields_can_be_decoded_as_ps_records() {
    let payload = native(vec![("count", mk_int(42))]);
    let result = object(JsonReadObjectProbe_readObjectWithRecord(boxed(native(
        vec![("payload", boxed(payload))],
    ))));
    let row = result.get("payload").unwrap();
    assert_eq!(row.__purust_get_field("count").unwrap().unwrap_int(), 42);
}

#[test]
fn empty_record_and_homogeneous_record_are_supported() {
    let empty = JsonReadObjectProbe_asObject(JsonReadObjectProbe_emptyRecordForeign(()));
    assert!(empty.entries().is_empty());
    let mut fields = purust_core::RecordFields::new();
    fields.insert("type".into(), mk_string("RaisedInt"));
    fields.insert("value".into(), mk_string("42"));
    let converted = JsonReadObjectProbe_fromHomogeneous(Value::DynamicRecord(
        perceus_ptr::PerceusPtr::new(fields),
    ));
    assert_eq!(converted.get("value").unwrap().unwrap_string(), "42");
}

#[test]
fn non_objects_are_rejected_by_readforeign_before_any_cast() {
    for value in [
        Value::Unit,
        Value::Null,
        mk_int(42),
        mk_string("x"),
        purust_core::mk_array(vec![]),
    ] {
        assert!(matches!(
            JsonReadObjectProbe_readObject(value).as_ref(),
            Either::Left(_)
        ));
    }
}
