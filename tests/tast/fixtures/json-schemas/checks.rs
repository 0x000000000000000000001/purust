use Purs_SchemaProbe::*;
use Purs_Data_Either::Either;
use purust_core::Value;
use std::rc::Rc;

fn parse(text: &str) -> Value {
    Purs_Data_Argonaut_Core::purust_json_parse_text(text).unwrap()
}
fn print(result: Rc<Either>) -> String { SchemaProbe_fingerprint(result) }
fn decoded(text: &str) -> String { print(SchemaProbe_decode(parse(text))) }

fn ordinary_text(text: String) -> String {
    print(SchemaProbe_decodeWith(purust_core::Func1::Static(SchemaProbe_decode), text))
}

#[test]
fn custom_constructors_and_owned_results() {
    let raw = r#"{"actions":[{"kind":"open","label":"first","limit":4},{"lines":[{"cost":1.5,"count":3}],"code":9,"kind":"close"}],"active":true}"#;
    let input = parse(raw);
    let result = SchemaProbe_decode(input.clone());
    let Either::Right(document) = result.as_ref() else { panic!("expected document"); };
    assert_eq!(SchemaProbe_consume(document.clone()), 10021);
    let changed = SchemaProbe_change(document.clone());
    assert_eq!(SchemaProbe_consume(changed), 28);
    assert_eq!(SchemaProbe_consume(document.clone()), 10021, "record updates must preserve aliases");
    let mut dynamic = document.clone().__purust_set_field("runtime-only", Value::Int(9));
    dynamic.set_active(Value::Bool(false));
    assert_eq!(dynamic.__purust_get_field("runtime-only").unwrap().unwrap_int(), 9);
    assert_eq!(SchemaProbe_consume(dynamic), 21);
    assert_eq!(document.__purust_record_fields().unwrap().into_entries().len(), 3);
    input.unwrap_class::<Rc<purust_core::SharedRecord>>().insert("active".into(), Value::Bool(false));
    let output = print(result);
    assert!(output.contains("\"active\":true"));
    assert!(output.contains("\"label\":\"first\""));
    assert!(output.contains("\"count\":3"));
    assert_eq!(output, print(SchemaProbe_decodeText(raw.into())));
}

#[test]
fn order_duplicates_optionals_and_errors() {
    let cases = [
        r#"{"actions":[],"active":true}"#,
        r#"{"note":null,"active":false,"actions":[{"limit":null,"label":"é","kind":"open"}]}"#,
        r#"{"active":"wrong","actions":[],"active":true}"#,
        r#"{"actions":[{"kind":"bad","kind":"open","label":"ok"}],"active":true}"#,
        r#"{"actions":[{"kind":"open","label":42}],"active":true}"#,
        r#"{"actions":[{"kind":"close","code":2147483648,"lines":[]}],"active":true}"#,
        r#"{"actions":[{"kind":"close","code":1,"lines":[{"count":1.5,"cost":0}]}],"active":true}"#,
        r#"{"actions":[{"kind":"unknown"}],"active":true}"#,
        r#"{"actions":false,"active":4}"#,
        r#"{"actions":[],"active":null}"#,
        r#"{"actions":[],"active":false,"note":7}"#,
        r#"{"actions":[{"kind":"open","label":"\ud800\udfff"}],"active":true}"#,
        r#"{"actions":[{"kind":"open","label":"\ud800a","limit":-0}],"active":true}"#,
    ];
    for raw in cases {
        assert_eq!(decoded(raw), print(SchemaProbe_decodeText(raw.into())), "{raw}");
    }
    assert!(decoded(r#"{"actions":[{"kind":"unknown"}],"active":true}"#).contains("Action kind"));
    assert!(decoded(r#"{"actions":[{"kind":"open"}],"active":true}"#).contains("label"));
}

#[test]
fn dynamic_decoder_is_called_and_errors_can_recover() {
    let fake = purust_core::Func1::Static(|_| SchemaProbe_decode(parse(r#"{"actions":[],"active":false}"#)));
    let result = SchemaProbe_decodeWith(fake, r#"{"actions":[],"active":true}"#.into());
    assert!(print(result).contains("\"active\":false"));
    let result = SchemaProbe_recover(parse(r#"{"item":"not an int"}"#));
    let Either::Right(record) = result.as_ref() else { panic!("recovery lost"); };
    let value = record.__purust_get_field("item").unwrap();
    let value = value.unwrap_class::<Rc<Recover>>();
    let Recover::Recover(number) = value.as_ref();
    assert_eq!(*number, 7);
    let result = SchemaProbe_twice(parse(r#"{"value":"twice"}"#));
    let Either::Right(value) = result.as_ref() else { panic!("repeated read lost"); };
    let value = value.unwrap_class::<Rc<Twice>>();
    let Twice::Twice(first, second) = value.as_ref();
    assert_eq!(first, "twice");
    assert_eq!(second, "twice");
}

#[test]
fn text_validates_ignored_fields_and_keeps_parser_errors() {
    let cases = [
        "", " ", "null", "[]", "{}", "undefined", "true false",
        r#"{"actions":[],"active":true,"ignored":01}"#,
        r#"{"actions":[],"active":true,"ignored":1e}"#,
        r#"{"actions":[],"active":true,"ignored":[0,]}"#,
        r#"{"actions":[],"active":true,"ignored":"\u00G0"}"#,
        r#"{"actions":[],"active":true,"ignored":{"a":}}"#,
        r#"{"actions":[],"active":true} trailing"#,
        r#"{"actions":false,"active":true,"ignored":+1}"#,
        r#"{"actions":[],"active":true,"ignored":1e400}"#,
        r#"{"actions":[],"active":true,"note":"\ud800","ignored":"\udfff"}"#,
        r#"{"actions":[],"active":false,"\u0061ctive":true}"#,
    ];
    for raw in cases {
        assert_eq!(print(SchemaProbe_decodeText(raw.into())), ordinary_text(raw.into()), "{raw}");
    }
    let deep = format!("{{\"actions\":[],\"active\":true,\"ignored\":{}0{}}}", "[".repeat(300), "]".repeat(300));
    assert_eq!(print(SchemaProbe_decodeText(deep.clone())), ordinary_text(deep));
    let raw = r#"{"actions":[{"kind":"open","label":"value\"quoted\uD800"}],"active":true,"ignored":[null,false,-1.7e+9]}"#;
    for end in 0..raw.len() {
        let truncated = &raw[..end];
        assert_eq!(print(SchemaProbe_decodeText(truncated.into())), ordinary_text(truncated.into()));
    }
}

#[test]
fn normalized_keys_strings_and_numeric_boundaries() {
    for number in ["0", "-0", "1.0", "1e0", "2147483647", "-2147483648", "2147483648", "-2147483649", "1.5", "1e400", "5e-324", "9007199254740993"] {
        let raw = format!("{{\"actions\":[{{\"kind\":\"close\",\"code\":{number},\"lines\":[{{\"count\":1,\"cost\":{number}}}]}}],\"active\":true}}");
        assert_eq!(print(SchemaProbe_decodeText(raw.clone())), ordinary_text(raw.clone()), "{raw}");
    }
    for start in (0..65536u32).step_by(256) {
        let text: String = (start..start+256).map(|unit| format!("\\u{unit:04x}")).collect();
        let raw = format!("{{\"actions\":[{{\"kind\":\"open\",\"label\":\"{text}\"}}],\"active\":true}}");
        assert_eq!(print(SchemaProbe_decodeText(raw.clone())), ordinary_text(raw));
    }
    for number in ["9".repeat(4096), format!("1e{}", "9".repeat(4096)), format!("-0.{}1", "0".repeat(4096))] {
        let raw = format!("{{\"actions\":[],\"active\":true,\"ignored\":{number}}}");
        assert_eq!(print(SchemaProbe_decodeText(raw.clone())), ordinary_text(raw));
    }
}

#[test]
fn differential_outputs_through_polymorphic_abi() {
    let mut output = Vec::new();
    let mut seed: u32 = 0x52705eed;
    for index in 0..512 {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        let code = seed % 100000;
        let kind = ["open", "close", "unknown"][index % 3];
        let active = ["true", "false", "null", "5"][index % 4];
        let optional = ["", ",\"note\":null", ",\"note\":\"unicode\\ud800\\uffff\"", ",\"note\":3"][index % 4];
        let raw = format!("{{\"actions\":[{{\"kind\":\"{kind}\",\"label\":\"title{index}\",\"limit\":{code},\"code\":{code},\"lines\":[{{\"cost\":0.5,\"count\":{index}}}]}}],\"active\":{active}{optional}}}");
        let result = SchemaProbe_decodeText(raw.clone());
        assert_eq!(print(result.clone()), decoded(&raw));
        if let Either::Right(value) = result.as_ref() {
            output.push(SchemaProbe_consume(value.clone()).to_string());
            output.push(print(Rc::new(Either::Right(SchemaProbe_change(value.clone())))));
        }
        output.push(print(result));
    }
    std::fs::write(std::env::var("SCHEMA_PROBE_OUTPUT").unwrap(), output.join("\n")).unwrap();
}
