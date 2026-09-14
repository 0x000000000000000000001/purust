use purust_core::Value;
use std::rc::Rc;
use Purs_Data_Either::Either;
use Purs_JS_BigInt::BigInt;
use Purs_JsonReadBigIntProbe::*;

fn right(value: Rc<Either>) -> Value {
    match value.as_ref() {
        Either::Right(value) => value.clone(),
        Either::Left(_) => panic!("expected a successful real ReadForeign BigInt"),
    }
}

fn decimal(value: Value) -> String {
    value.unwrap_class::<Rc<BigInt>>().to_string()
}

#[test]
fn read_foreign_recognizes_the_real_native_carrier() {
    for text in ["0", "-1", "1234567890123456789012345678901234567890"] {
        let integer = Rc::new(text.parse::<BigInt>().unwrap());
        let foreign = Value::Class(Rc::new(integer.clone()));
        assert_eq!(Purs_Foreign::Foreign_tagOf(foreign.clone()), "BigInt");
        assert_eq!(Purs_Foreign::Foreign_typeOf(foreign.clone()), "bigint");
        let read = right(JsonReadBigIntProbe_readNative(foreign));
        assert!(Rc::ptr_eq(&integer, read.unwrap_class::<Rc<BigInt>>()));
        assert_eq!(decimal(read), text);
    }
}

#[test]
fn read_json_uses_the_reviver_and_readforeign_dictionary() {
    for (json, expected) in [
        (r#"{"big":"123456789012345678901234567890"}"#, "123456789012345678901234567890"),
        (r#"{"big":"-0x1","big":"-42"}"#, "-42"),
        (r#"{"big":9007199254740993}"#, "9007199254740992"),
        (r#"{"big":"0xFF"}"#, "255"),
        (r#"{"big":true}"#, "1"),
    ] {
        assert_eq!(decimal(right(JsonReadBigIntProbe_readField(json.into()))), expected);
    }
}

#[test]
fn read_json_traverses_arrays_of_native_bigints() {
    let values = right(JsonReadBigIntProbe_readFields(r#"[{"big":"-12345678901234567890"},{"big":"0b101"}]"#.into()));
    assert_eq!(values.unwrap_array().iter().cloned().map(decimal).collect::<Vec<_>>(), ["-12345678901234567890", "5"]);
}

#[test]
fn non_bigint_carriers_are_not_misclassified() {
    for value in [Value::Null, Value::Unit, Value::Bool(true), Value::Class(Rc::new(Rc::new(purust_core::SharedRecord::empty())))] {
        assert_ne!(Purs_Foreign::Foreign_tagOf(value.clone()), "BigInt");
        assert!(matches!(JsonReadBigIntProbe_readNative(value).as_ref(), Either::Left(_)));
    }
}

#[test]
fn parser_and_reviver_errors_reach_purescript_as_left() {
    for json in ["{", r#"{"big":null}"#, r#"{"big":1.5}"#, r#"{"big":"not an integer"}"#] {
        assert!(matches!(JsonReadBigIntProbe_readField(json.into()).as_ref(), Either::Left(_)));
    }
}
