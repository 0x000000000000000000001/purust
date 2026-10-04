#![allow(warnings)]
use purust_core::*;
use std::sync::Arc as Rc;
use Purs_Data_Either::Either;
use Purs_Data_Argonaut_Decode_Error::{JsonDecodeError, Data_Argonaut_Decode_Error_printJsonDecodeError};
use Purs_PureScript_Backend_Optimizer_CoreFn::{ExprType, PureScript_Backend_Optimizer_CoreFn_eqExprType};
mod candidate {
    use purust_core::*;
    use Purs_PureScript_Backend_Optimizer_CoreFn_Json::{
        PureScript_Backend_Optimizer_CoreFn_Json_decodeReExports,
        PureScript_Backend_Optimizer_CoreFn_Json_decodeComment,
        PureScript_Backend_Optimizer_CoreFn_Json_decodeDataDecl,
        PureScript_Backend_Optimizer_CoreFn_Json_decodeClassDecl,
        PureScript_Backend_Optimizer_CoreFn_Json_decodeSourceSpan,
    };
    // NATIVE_FFI
    pub fn fast(input: &Value) -> bool { purust_type_table::decode(input).is_some() }
}
fn error(value: &Value) -> String {
    Data_Argonaut_Decode_Error_printJsonDecodeError(value.unwrap_class_shared::<JsonDecodeError>())
}
fn compare(input: Value) -> bool {
    let fast = candidate::fast(&input);
    let expected = Purs_PureScript_Backend_Optimizer_CoreFn_TypeTable::PureScript_Backend_Optimizer_CoreFn_TypeTable_decodeTypeTablePS(input.clone());
    let actual = candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeTypeTableImpl(input);
    match (actual.as_ref(), expected.as_ref()) {
        (Either::Left(a), Either::Left(b)) => assert_eq!(error(a), error(b)),
        (Either::Right(a), Either::Right(b)) => {
            assert_eq!(a.array_len(), b.array_len());
            let eq = PureScript_Backend_Optimizer_CoreFn_eqExprType();
            for i in 0..a.array_len() {
                assert!((eq.eq)(a.array_get(i), b.array_get(i)), "different type at index {i}");
            }
        }
        (Either::Left(a), _) => panic!("unexpected error: {}", error(a)),
        (_, Either::Left(b)) => panic!("missed error: {}", error(b)),
    }
    fast
}
fn main() {
    let path = std::env::args().nth(1).expect("cases");
    let contents = std::fs::read_to_string(path).unwrap();
    let mut tables = 0; let mut types = 0; let mut fast = 0;
    for (i, line) in contents.lines().enumerate() {
        let (mode, json) = line.split_once('\t').unwrap();
        let input = Purs_Data_Argonaut_Core::purust_json_parse_text(&purust_string_from_utf8(json)).unwrap();
        types += input.array_len();
        let used = compare(input);
        match mode {
            "fast" => assert!(used, "valid DAG {i} fell back"),
            "fallback" => assert!(!used, "error/cycle {i} bypassed the reference"),
            _ => {},
        }
        tables += 1; fast += usize::from(used);
    }
    // Two references to the same decoded entry retain shared ownership.
    let input = Purs_Data_Argonaut_Core::purust_json_parse_text(r#"["Int",{"type":"Array","element":0},{"type":"Record","row":0}]"#).unwrap();
    let result = candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeTypeTableImpl(input);
    let Either::Right(rows) = result.as_ref() else { panic!("Right") };
    let base = rows.array_get(0).unwrap_class_shared::<ExprType>();
    let array = rows.array_get(1).unwrap_class_shared::<ExprType>();
    let record = rows.array_get(2).unwrap_class_shared::<ExprType>();
    let ExprType::Array(element) = array.as_ref() else { panic!("Array") };
    let ExprType::Record(row) = record.as_ref() else { panic!("Record") };
    assert!(Rc::ptr_eq(&base, element) && Rc::ptr_eq(&base, row));
    println!("Native type table: {tables} differential tables / {types} entries; {fast} fast paths; exact errors and shared references passed");
}
