use Purs_SchemaProbe::*;
use Purs_Data_Either::Either;
use purust_core::Value;
use std::rc::Rc;

// Count allocations on this test thread only, including Arc-mode runs. This
// guards the reader/consumer contract rather than the decoder's code shape.
struct Counting;
thread_local! { static ALLOCATIONS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) }; }
unsafe impl std::alloc::GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: std::alloc::Layout) -> *mut u8 {
        ALLOCATIONS.with(|n| n.set(n.get() + 1));
        std::alloc::GlobalAlloc::alloc(&std::alloc::System, layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: std::alloc::Layout) {
        std::alloc::GlobalAlloc::dealloc(&std::alloc::System, ptr, layout)
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: std::alloc::Layout, size: usize) -> *mut u8 {
        ALLOCATIONS.with(|n| n.set(n.get() + 1));
        std::alloc::GlobalAlloc::realloc(&std::alloc::System, ptr, layout, size)
    }
}
#[global_allocator]
static ALLOCATOR: Counting = Counting;

fn parse(text: &str) -> Value {
    Purs_Data_Argonaut_Core::purust_json_parse_text(text).unwrap()
}
fn print(result: Rc<Either>) -> String { SchemaProbe_fingerprint(result) }
fn decoded(text: &str) -> String { print(SchemaProbe_decode(parse(text))) }

fn ordinary_text(text: String) -> String {
    print(SchemaProbe_decodeWith(purust_core::Func1::Static(SchemaProbe_decode), text))
}

#[test]
fn constructors_transfer_owned_arguments_and_preserve_partial_captures() {
    let original = "owned constructor string".to_owned();
    let label = original.clone();
    let address = label.as_ptr();
    let limit = Rc::new(Purs_Data_Maybe::Maybe::Just(Value::Int(17)));
    let before = ALLOCATIONS.with(|n| n.get());
    let action = SchemaProbe_Open(label, limit.clone());
    assert_eq!(ALLOCATIONS.with(|n| n.get()) - before, 1, "only the ADT node is allocated");
    let Action::Open(label, value) = action.as_ref() else { panic!("Open"); };
    assert_eq!(label.as_ptr(), address, "owned strings move into the constructor");
    assert_eq!(label, &original);
    assert!(Rc::ptr_eq(value, &limit));
    let actions = SchemaProbe_reusedBuilder(original.clone());
    for index in 0..2 {
        let value = actions.array_get(index);
        let action = value.unwrap_class_shared::<Action>();
        let Action::Open(label, limit) = action.as_ref() else { panic!("Open"); };
        assert_eq!(label, &original);
        match (index, limit.as_ref()) {
            (0, Purs_Data_Maybe::Maybe::Nothing) => {}
            (1, Purs_Data_Maybe::Maybe::Just(value)) => assert_eq!(value.unwrap_int(), 7),
            _ => panic!("partial application lost its capture"),
        }
    }
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
fn escaping_array_elements_retain_identity_and_owned_storage() {
    let result = SchemaProbe_decodeText(r#"{"actions":[{"kind":"close","code":9,"lines":[{"cost":1.5,"count":3}]}],"active":true}"#.into());
    let Either::Right(document) = result.as_ref() else { panic!("document"); };
    let actions = document.__purust_get_field("actions").unwrap();
    let action = actions.array_get(0);
    let again = actions.array_get(0);
    assert!(Rc::ptr_eq(&action.unwrap_class_shared::<Action>(), &again.unwrap_class_shared::<Action>()));
    assert!(action.__purust_record_fields().is_none());
    let action_value = action.unwrap_class_shared::<Action>();
    let Action::Close(_, lines) = action_value.as_ref() else { panic!("Close"); };
    let line = lines.array_get(0);
    let before = ALLOCATIONS.with(|n| n.get());
    for _ in 0..32 {
        let items = purust_core::IntItems::from(lines);
        assert_eq!(items.len(), 1);
        assert_eq!(items.raw(0).get_count().unwrap_int(), 3);
        assert_eq!(lines.array_iter().rev().map(|line| line.get_count().unwrap_int()).sum::<i64>(), 3);
    }
    assert_eq!(ALLOCATIONS.with(|n| n.get()), before, "indexing and traversing records must not allocate wrappers or buffers");
    if let Value::NativeElement(owner, index) = &line {
        let Value::NativeElement(other, other_index) = lines.array_get(0) else { panic!("view"); };
        assert!(Rc::ptr_eq(owner, &other));
        assert_eq!(*index, other_index);
        assert_eq!(std::mem::size_of::<Value>(), 24, "views must not enlarge every Value");
    }
    drop(result);
    drop(actions);
    drop(action);
    drop(again);
    assert_eq!(line.get_count().unwrap_int(), 3);
    let changed = line.clone().__purust_set_field("count", Value::Int(99));
    assert_eq!(changed.get_count().unwrap_int(), 99);
    assert_eq!(line.get_count().unwrap_int(), 3);
    assert_eq!(line.__purust_foreign_object().get("cost").unwrap().unwrap_number(), 1.5);
}

#[test]
fn absent_values_are_owned_by_the_result_and_released_with_it() {
    let raw = r#"{"actions":[{"kind":"open","label":"first"},{"kind":"open","label":"second","limit":null}],"active":true}"#;
    let result = SchemaProbe_decodeText(raw.into());
    let Either::Right(document) = result.as_ref() else { panic!("document"); };
    let note = document.__purust_get_field("note").unwrap();
    let weak = Rc::downgrade(&note.unwrap_class_shared::<Purs_Data_Maybe::Maybe>());
    assert!(matches!(weak.upgrade().unwrap().as_ref(), Purs_Data_Maybe::Maybe::Nothing));
    drop(note);
    drop(result);
    assert!(weak.upgrade().is_none(), "decoding must not retain a global optional cache");
}

#[test]
fn order_duplicates_optionals_and_errors() {
    let cases = [
        r#"{"actions":[],"active":true}"#,
        r#"{"note":null,"active":false,"actions":[{"limit":null,"label":"é","kind":"open"}]}"#,
        r#"{"active":"wrong","actions":[],"active":true}"#,
        r#"{"actions":[{"kind":"bad","kind":"open","label":"ok"}],"active":true}"#,
        r#"{"actions":[{"kind":"\u006fpen","label":"escaped discriminator"}],"active":true}"#,
        r#"{"actions":[{"kind":17,"label":"wrong discriminator type"}],"active":true}"#,
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
    let value = value.unwrap_class_shared::<Recover>();
    let Recover::Recover(number) = value.as_ref();
    assert_eq!(*number, 7);
    let result = SchemaProbe_twice(parse(r#"{"value":"twice"}"#));
    let Either::Right(value) = result.as_ref() else { panic!("repeated read lost"); };
    let value = value.unwrap_class_shared::<Twice>();
    let Twice::Twice(first, second) = value.as_ref();
    assert_eq!(first, "twice");
    assert_eq!(second, "twice");
    for raw in [r#"{"tag":"echo"}"#, r#"{"tag":"\u0065cho"}"#] {
        for result in [SchemaProbe_tagged(parse(raw)), SchemaProbe_taggedText(raw.into())] {
            let Either::Right(value) = result.as_ref() else { panic!("retained discriminator"); };
            let value = value.unwrap_class_shared::<Tagged>();
            let Tagged::Tagged(tag) = value.as_ref();
            assert_eq!(tag, "echo", "a discriminator used in the result must be owned");
        }
    }
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
    for number in ["0", "-0", "1.0", "1e0", "2147483647", "-2147483648", "2147483648", "-2147483649", "2147483647.00000001", "-2147483648.00000001", "21474836470e-1", "9999999999", "1.5", "1e400", "5e-324", "9007199254740993"] {
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
    for escape in [r#"\""#, r#"\uD800"#, r#"\uD800\uDFFF"#, r#"\n\t\b"#] {
        let raw = format!("{{\"actions\":[{{\"kind\":\"open\",\"label\":\"{}{escape}{}\"}}],\"active\":true}}", "plain é ".repeat(256), "tail ".repeat(256));
        assert_eq!(print(SchemaProbe_decodeText(raw.clone())), ordinary_text(raw));
    }
}

#[test]
fn differential_outputs_through_polymorphic_abi() {
    let mut output = Vec::new();
    for raw in [
        r#"{"integers":[],"decimals":[],"flags":[],"names":[],"lines":[],"groups":[]}"#,
        r#"{"integers":[-2147483648,0,2147483647],"decimals":[-0,1e-300,1.5],"flags":[true,false,true],"names":["a","\ud800","\udfff"],"lines":[{"count":1,"cost":3},{"count":2,"cost":2},{"count":3,"cost":1}],"groups":[[],[{"count":7,"cost":0}]]}"#,
        r#"{"integers":[0,2147483648],"decimals":[],"flags":[],"names":[],"lines":[],"groups":[]}"#,
        r#"{"integers":[],"decimals":[1,false],"flags":[],"names":[],"lines":[],"groups":[]}"#,
    ] {
        let result = SchemaProbe_decodeArraysText(raw.into());
        assert_eq!(SchemaProbe_fingerprintArrays(result.clone()), SchemaProbe_fingerprintArrays(SchemaProbe_decodeArrays(parse(raw))));
        if let Either::Right(value) = result.as_ref() {
            output.push(SchemaProbe_arrayOps(value.clone()));
            // Public fromArray keeps the native representation. Feed it back
            // into both the generated DOM decoder and the ordinary fallback.
            let input = parse(raw);
            let object = input.unwrap_class::<Rc<purust_core::SharedRecord>>();
            for key in ["integers", "decimals", "flags", "names"] {
                let array = value.__purust_get_field(key).unwrap();
                let json = Purs_Data_Argonaut_Core::Data_Argonaut_Core_fromArray(array);
                assert_eq!(Purs_Data_Argonaut_Core::Data_Argonaut_Core_stringify(json.clone()),
                    Purs_Data_Argonaut_Core::Data_Argonaut_Core_stringify(object.get(key).unwrap()));
                object.insert(key.into(), json);
            }
            assert_eq!(SchemaProbe_fingerprintArrays(result.clone()), SchemaProbe_fingerprintArrays(SchemaProbe_decodeArrays(input)));
        }
        output.push(SchemaProbe_fingerprintArrays(result));
    }
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
