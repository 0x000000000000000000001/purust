#![allow(warnings)]
use purust_core::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc as Rc;
use std::sync::Mutex;
use Purs_Data_Argonaut_Decode_Error::{JsonDecodeError, Data_Argonaut_Decode_Error_printJsonDecodeError};
use Purs_Data_Either::Either;
use Purs_Data_Maybe::Maybe;
use Purs_Foreign_Object::Object;
use Purs_PureScript_Backend_Optimizer_CoreFn::{ExprType, Meta};
use Purs_PureScript_Backend_Optimizer_CoreFn_Json::{
    PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsagePS,
    PureScript_Backend_Optimizer_CoreFn_Json_decodeArrayPS,
};

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
}

fn parse(text: &str) -> Value {
    Purs_Data_Argonaut_Core::purust_json_parse_text(&purust_string_from_utf8(text)).expect("valid JSON")
}

fn error_string(value: &Value) -> String {
    Data_Argonaut_Decode_Error_printJsonDecodeError(value.unwrap_class::<Rc<JsonDecodeError>>().clone())
}

fn same_error(a: &Value, b: &Value) -> bool {
    fn equal(a: &JsonDecodeError, b: &JsonDecodeError) -> bool {
        match (a, b) {
            (JsonDecodeError::TypeMismatch(x), JsonDecodeError::TypeMismatch(y)) => x == y,
            (JsonDecodeError::UnexpectedValue(x), JsonDecodeError::UnexpectedValue(y)) => eq_json(x, y),
            (JsonDecodeError::AtIndex(i, x), JsonDecodeError::AtIndex(j, y)) => i == j && equal(x, y),
            (JsonDecodeError::AtKey(i, x), JsonDecodeError::AtKey(j, y))
            | (JsonDecodeError::Named(i, x), JsonDecodeError::Named(j, y)) => i == j && equal(x, y),
            (JsonDecodeError::MissingValue, JsonDecodeError::MissingValue) => true,
            _ => false,
        }
    }
    equal(a.unwrap_class::<Rc<JsonDecodeError>>(), b.unwrap_class::<Rc<JsonDecodeError>>())
}

fn maybe(value: &Value) -> &Maybe {
    value.unwrap_class::<Rc<Maybe>>().as_ref()
}

fn object_field(value: &Value, key: &str) -> Value {
    value.__purust_foreign_object().get(key).unwrap_or_else(|| panic!("missing field {key}"))
}

fn eq_pos(a: &Value, b: &Value) -> bool {
    a.get_line().unwrap_int() == b.get_line().unwrap_int()
        && a.get_column().unwrap_int() == b.get_column().unwrap_int()
}

fn eq_span(a: &Value, b: &Value) -> bool {
    a.get_path().unwrap_string() == b.get_path().unwrap_string()
        && eq_pos(&a.get_start(), &b.get_start())
        && eq_pos(&a.get_end(), &b.get_end())
}

fn eq_meta_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            let eq = Purs_PureScript_Backend_Optimizer_CoreFn::PureScript_Backend_Optimizer_CoreFn_eqMeta();
            (eq.eq)(x.clone(), y.clone())
        }
        _ => false,
    }
}

fn eq_type_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            let eq = Purs_PureScript_Backend_Optimizer_CoreFn::PureScript_Backend_Optimizer_CoreFn_eqExprType();
            (eq.eq)(x.clone(), y.clone())
        }
        _ => false,
    }
}

fn eq_bool_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => x.unwrap_bool() == y.unwrap_bool(),
        _ => false,
    }
}

fn eq_int_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => x.unwrap_int() == y.unwrap_int(),
        _ => false,
    }
}

fn eq_binding(a: &Value, b: &Value) -> bool {
    a.get_moduleName().unwrap_string() == b.get_moduleName().unwrap_string()
        && a.get_bindingId().unwrap_int() == b.get_bindingId().unwrap_int()
}

fn eq_binding_usage_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            eq_binding(&x.get_binding(), &y.get_binding())
                && eq_int_maybe(&x.get_maxUses(), &y.get_maxUses())
                && eq_bool_maybe(&x.get_hasEscapingUseContext(), &y.get_hasEscapingUseContext())
        }
        _ => false,
    }
}

fn eq_variable_use_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            eq_binding(&x.get_binding(), &y.get_binding())
                && eq_bool_maybe(&x.get_lastLocalUse(), &y.get_lastLocalUse())
        }
        _ => false,
    }
}

fn eq_usage_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            eq_binding_usage_maybe(&x.get_bindingUsage(), &y.get_bindingUsage())
                && eq_variable_use_maybe(&x.get_variableUse(), &y.get_variableUse())
        }
        _ => false,
    }
}

fn eq_ann(a: &Value, b: &Value) -> bool {
    eq_span(&a.get_span(), &b.get_span())
        && eq_meta_maybe(&a.get_meta(), &b.get_meta())
        && eq_type_maybe(&a.get_type_kw(), &b.get_type_kw())
        && eq_usage_maybe(&a.get_sourceUsage(), &b.get_sourceUsage())
}

fn eq_json(a: &Value, b: &Value) -> bool {
    match (a.resolve(), b.resolve()) {
        (Value::Null, Value::Null) | (Value::Unit, Value::Unit) => true,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Int(x), Value::Int(y)) => x == y,
        (Value::Number(x), Value::Number(y)) => x.to_bits() == y.to_bits(),
        (Value::Int(x), Value::Number(y)) | (Value::Number(y), Value::Int(x)) => (*x as f64) == *y,
        (Value::String(x), Value::String(y)) => x == y,
        (Value::Char(x), Value::Char(y)) => x == y,
        (Value::Array(x), Value::Array(y)) => {
            x.len() == y.len() && x.iter().zip(y.iter()).all(|(x, y)| eq_json(x, y))
        }
        (Value::Class(_), Value::Class(_)) => {
            let x = a.unwrap_class::<Rc<Object>>().entries();
            let y = b.unwrap_class::<Rc<Object>>().entries();
            x.len() == y.len() && x.iter().zip(y.iter()).all(|((kx, vx), (ky, vy))| kx == ky && eq_json(vx, vy))
        }
        _ => false,
    }
}

struct ArrayRun {
    candidate: Rc<Either>,
    reference: Rc<Either>,
    fallback_calls: usize,
    candidate_calls: usize,
    reference_calls: usize,
}

fn run_array(input: &Value, fail_at: Option<usize>) -> ArrayRun {
    let calls = Rc::new(AtomicUsize::new(0));
    let logic_calls = calls.clone();
    let logic: Rc<dyn Fn(Value) -> Rc<Either> + Send + Sync> = Rc::new(move |value: Value| {
        let call = logic_calls.fetch_add(1, Ordering::SeqCst);
        if Some(call) == fail_at {
            Rc::new(Either::Left(Value::Class(Rc::new(Rc::new(JsonDecodeError::TypeMismatch(String::from("element")))))))
        } else {
            Rc::new(Either::Right(value))
        }
    });
    let candidate_decoder = Func1::Shared(Rc::new({
        let logic = logic.clone();
        move |value: Value| -> Value { Value::Class(Rc::new(logic(value))) }
    }));
    let reference_decoder = Func1::Shared(Rc::new({
        let logic = logic.clone();
        move |value: Value| -> Rc<Either> { logic(value) }
    }));
    let fallback_calls = Rc::new(AtomicUsize::new(0));
    let fallback_counter = fallback_calls.clone();
    let fallback = Func2::Shared(Rc::new(move |_decoder: Func1<Value, Value>, _input: Value| -> Value {
        fallback_counter.fetch_add(1, Ordering::SeqCst);
        Value::String(String::from("fallback"))
    }));
    let candidate_value =
        candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeArrayImpl(fallback, candidate_decoder, input.clone());
    let candidate_calls = calls.swap(0, Ordering::SeqCst);
    let candidate = candidate_value.unwrap_class::<Rc<Either>>().clone();
    let reference = PureScript_Backend_Optimizer_CoreFn_Json_decodeArrayPS(reference_decoder, input.clone());
    let reference_calls = calls.swap(0, Ordering::SeqCst);
    ArrayRun { candidate, reference, fallback_calls: fallback_calls.load(Ordering::SeqCst), candidate_calls, reference_calls }
}

fn run_array_non_array(input: &Value) -> (bool, usize, usize) {
    let calls = Rc::new(AtomicUsize::new(0));
    let decoder_calls = calls.clone();
    let decoder = Func1::Shared(Rc::new(move |value: Value| -> Value {
        decoder_calls.fetch_add(1, Ordering::SeqCst);
        Value::Class(Rc::new(Rc::new(Either::Right(value))))
    }));
    let fallback_calls = Rc::new(AtomicUsize::new(0));
    let fallback_counter = fallback_calls.clone();
    let fallback = Func2::Shared(Rc::new(move |_decoder: Func1<Value, Value>, _input: Value| -> Value {
        fallback_counter.fetch_add(1, Ordering::SeqCst);
        Value::String(String::from("fallback"))
    }));
    let result =
        candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeArrayImpl(fallback, decoder, input.clone());
    let sentinel = matches!(result.resolve(), Value::String(text) if text == "fallback");
    (sentinel, fallback_calls.load(Ordering::SeqCst), calls.load(Ordering::SeqCst))
}

struct AnnRun {
    candidate: Rc<Either>,
    reference: Rc<Either>,
    fallback_calls: usize,
}

fn decode_table(value: &Value) -> Value {
    match candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeTypeTableImpl(value.clone()).as_ref() {
        Either::Right(rows) => rows.clone(),
        Either::Left(error) => panic!("invalid test type table: {}", error_string(error)),
    }
}

fn run_ann(module: &str, table: &Value, input: &Value) -> AnnRun {
    let fallback_calls = Rc::new(AtomicUsize::new(0));
    let fallback_counter = fallback_calls.clone();
    let fallback = Func4::Shared(Rc::new(move |module: String, table: Value, path: String, input: Value| -> Value {
        fallback_counter.fetch_add(1, Ordering::SeqCst);
        Value::Class(Rc::new(PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsagePS(module, table, path, input)))
    }));
    let path = String::from("test/path");
    let candidate_value = candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsageImpl(
        fallback, module.to_owned(), table.clone(), path.clone(), input.clone());
    let candidate = candidate_value.unwrap_class::<Rc<Either>>().clone();
    let reference = PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsagePS(
        module.to_owned(), table.clone(), path, input.clone());
    AnnRun { candidate, reference, fallback_calls: fallback_calls.load(Ordering::SeqCst) }
}

fn compare_ann(run: &AnnRun, context: &str) -> bool {
    match (run.candidate.as_ref(), run.reference.as_ref()) {
        (Either::Left(a), Either::Left(b)) => {
            assert!(same_error(a, b), "{context}: different error trees");
            assert_eq!(error_string(a), error_string(b), "{context}");
            false
        }
        (Either::Right(a), Either::Right(b)) => {
            assert!(eq_ann(a, b), "{context}");
            true
        }
        (Either::Left(a), Either::Right(_)) => panic!("{context}: unexpected error {}", error_string(a)),
        (Either::Right(_), Either::Left(b)) => panic!("{context}: missed error {}", error_string(b)),
    }
}

fn type_entry(ann: &Value) -> Rc<ExprType> {
    let value = ann.get_type_kw();
    match maybe(&value) {
        Maybe::Just(entry) => entry.unwrap_class::<Rc<ExprType>>().clone(),
        Maybe::Nothing => panic!("expected a type"),
    }
}

fn meta_entry(ann: &Value) -> Rc<Meta> {
    let value = ann.get_meta();
    match maybe(&value) {
        Maybe::Just(entry) => entry.unwrap_class::<Rc<Meta>>().clone(),
        Maybe::Nothing => panic!("expected a meta"),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    assert_eq!(args.len(), 4, "Usage: purust_native_tast_test ARRAYS ANNOTATIONS CORPUS");

    // 1. decodeArrayImpl: one callback per element in order, AtIndex on the
    // first error, no fallback after a callback error, fallback before any
    // callback for a non-array.
    let arrays_text = std::fs::read_to_string(&args[1]).unwrap();
    let (mut arrays_fast, mut arrays_errors, mut arrays_non_arrays) = (0usize, 0usize, 0usize);
    for (number, line) in arrays_text.lines().enumerate() {
        if line.is_empty() { continue; }
        let mut cells = line.splitn(3, '\t');
        let mode = cells.next().unwrap();
        let fail = cells.next().unwrap();
        let input = parse(cells.next().unwrap());
        if mode == "nonarray" {
            let (sentinel, fallbacks, calls) = run_array_non_array(&input);
            assert!(sentinel, "array case {number}: the fallback result must be returned");
            assert_eq!(fallbacks, 1, "array case {number}: a non-array must fall back once");
            assert_eq!(calls, 0, "array case {number}: no callback before the fallback");
            arrays_non_arrays += 1;
            continue;
        }
        let fail_at = (fail != "-").then(|| fail.parse::<usize>().unwrap());
        let run = run_array(&input, fail_at);
        assert_eq!(run.candidate_calls, run.reference_calls, "array case {number}: callback counts differ");
        match (run.candidate.as_ref(), run.reference.as_ref()) {
            (Either::Left(a), Either::Left(b)) => {
                assert!(same_error(a, b), "array case {number}: different error trees");
                assert_eq!(error_string(a), error_string(b), "array case {number}");
            }
            (Either::Right(a), Either::Right(b)) => {
                assert!(eq_json(a, b), "array case {number}: values differ");
                assert_eq!(run.candidate_calls, input.array_len(), "array case {number}: each element once");
            }
            (Either::Left(a), Either::Right(_)) => panic!("array case {number}: unexpected error {}", error_string(a)),
            (Either::Right(_), Either::Left(b)) => panic!("array case {number}: missed error {}", error_string(b)),
        }
        assert_eq!(run.fallback_calls, 0, "array case {number}: callback errors must not re-enter the fallback");
        if mode == "error" {
            assert_eq!(run.candidate_calls, fail_at.unwrap() + 1, "array case {number}: must stop at the first error");
            arrays_errors += 1;
        } else {
            assert!(mode == "fast", "array case {number}: unknown mode {mode}");
            arrays_fast += 1;
        }
    }

    // 2. Generated annotations: every valid shape must use the native fast
    // path; invalid shapes must delegate once and reproduce the exact error.
    let annotations_text = std::fs::read_to_string(&args[2]).unwrap();
    let (mut annotations_fast, mut annotations_fallback) = (0usize, 0usize);
    for (number, line) in annotations_text.lines().enumerate() {
        if line.is_empty() { continue; }
        let mut cells = line.splitn(4, '\t');
        let mode = cells.next().unwrap();
        let module = purust_string_from_utf8(cells.next().unwrap());
        let table = decode_table(&parse(cells.next().unwrap()));
        let input = parse(cells.next().unwrap());
        let run = run_ann(&module, &table, &input);
        let context = format!("annotation case {number} ({mode})");
        let right = compare_ann(&run, &context);
        match mode {
            "fast" => {
                assert_eq!(run.fallback_calls, 0, "{context}: expected the native fast path");
                assert!(right, "{context}: expected a successful decode");
                annotations_fast += 1;
            }
            "fallback" => {
                assert_eq!(run.fallback_calls, 1, "{context}: expected exactly one fallback");
                assert!(!right, "{context}: invalid fixture unexpectedly succeeded");
                annotations_fallback += 1;
            }
            other => panic!("annotation case {number}: unknown mode {other}"),
        }
    }

    // 3. Frozen corpus: every real annotation is compared to the PureScript
    // reference, and valid ones must not silently retake the PS path.
    let corpus_text = std::fs::read_to_string(&args[3]).unwrap();
    let (mut corpus_modules, mut corpus_annotations) = (0usize, 0usize);
    let (mut corpus_native, mut corpus_errors, mut corpus_declined) = (0usize, 0usize, 0usize);
    let mut declined_examples: Vec<String> = Vec::new();
    for (number, line) in corpus_text.lines().enumerate() {
        if line.is_empty() { continue; }
        let mut cells = line.splitn(3, '\t');
        let module = purust_string_from_utf8(cells.next().unwrap());
        let table = decode_table(&parse(cells.next().unwrap()));
        let annotations = parse(cells.next().unwrap());
        corpus_modules += 1;
        for index in 0..annotations.array_len() {
            let input = annotations.array_get(index);
            let run = run_ann(&module, &table, &input);
            let context = format!("corpus {number}#{index} in {module}");
            if compare_ann(&run, &context) {
                if run.fallback_calls == 0 {
                    corpus_native += 1;
                } else {
                    corpus_declined += 1;
                    if declined_examples.len() < 5 { declined_examples.push(context); }
                }
            } else {
                corpus_errors += 1;
            }
            corpus_annotations += 1;
        }
    }
    assert_eq!(corpus_declined, 0, "valid annotations bypassed the native fast path: {declined_examples:?}");

    // 4. Targeted properties not expressible as parsed JSON alone.
    let module = purust_string_from_utf8("Native.Tast.Test");
    let table = decode_table(&parse("[\"Int\",\"String\",{\"type\":\"Array\",\"element\":0}]"));

    // A Char is a valid decodeString input, including in meta identifiers.
    {
        let input = parse("{\"meta\":{\"metaType\":\"IsConstructor\",\"constructorType\":\"ProductType\",\"identifiers\":[\"a\"]}}");
        let meta_object = object_field(&input, "meta").unwrap_class::<Rc<Object>>().clone();
        drop(meta_object.insert(
            String::from("identifiers"),
            mk_array(vec![Value::String(String::from("a")), Value::Char('b')]),
        ));
        let run = run_ann(&module, &table, &input);
        assert_eq!(run.fallback_calls, 0, "char identifiers must stay on the native fast path");
        assert!(compare_ann(&run, "char identifiers"));
    }

    // Annotations ignore their sourceSpan and always report emptySpan.
    {
        let input = parse("{\"sourceSpan\":{\"start\":[4,2],\"end\":[9,7]},\"meta\":{\"metaType\":\"IsWhere\"},\"type\":0}");
        let run = run_ann(&module, &table, &input);
        assert_eq!(run.fallback_calls, 0, "a sourceSpan must not force the fallback");
        assert!(compare_ann(&run, "sourceSpan ignored"));
        let Either::Right(ann) = run.candidate.as_ref() else { panic!("expected success") };
        let span = ann.get_span();
        assert_eq!(span.get_path().unwrap_string(), purust_string_from_utf8("<internal>"));
        assert_eq!(span.get_start().get_line().unwrap_int(), 0);
        assert_eq!(span.get_start().get_column().unwrap_int(), 0);
        assert_eq!(span.get_end().get_line().unwrap_int(), 0);
        assert_eq!(span.get_end().get_column().unwrap_int(), 0);
    }

    // Lone surrogates in strings and module names survive the result and stop
    // borrowing the decoded input.
    {
        let unit_string = purust_string_from_utf16(&[0x61, 0xd800, 0xdfff]);
        let escaped_module = purust_string_from_utf16(&[0x4d, 0x2e, 0xd800]);
        let input = parse("{\"meta\":{\"metaType\":\"IsConstructor\",\"constructorType\":\"SumType\",\"identifiers\":[]},\"bindingUsage\":{\"bindingId\":9,\"maxUses\":3,\"hasEscapingUseContext\":true}}");
        let meta_object = object_field(&input, "meta").unwrap_class::<Rc<Object>>().clone();
        drop(meta_object.insert(
            String::from("identifiers"),
            mk_array(vec![Value::String(unit_string.clone()), Value::Char('z')]),
        ));
        let unicode_table = table.clone();
        let run = run_ann(&escaped_module, &unicode_table, &input);
        assert_eq!(run.fallback_calls, 0, "unicode annotation must stay on the native fast path");
        assert!(compare_ann(&run, "unicode annotation"));
        drop(input);
        drop(unicode_table);
        let Either::Right(ann) = run.candidate.as_ref() else { panic!("expected success") };
        let meta_value = ann.get_meta();
        let Maybe::Just(meta_value) = maybe(&meta_value) else { panic!("expected meta") };
        let Meta::IsConstructor(_, identifiers) = meta_value.unwrap_class::<Rc<Meta>>().as_ref() else {
            panic!("expected IsConstructor")
        };
        assert_eq!(identifiers.array_len(), 2);
        assert_eq!(identifiers.array_get(0).unwrap_string(), unit_string);
        assert_eq!(identifiers.array_get(1).unwrap_string(), purust_string_from_utf8("z"));
        let usage = ann.get_sourceUsage();
        let Maybe::Just(usage) = maybe(&usage) else { panic!("expected source usage") };
        let binding_usage = usage.get_bindingUsage();
        let Maybe::Just(binding_usage) = maybe(&binding_usage) else { panic!("expected binding usage") };
        assert_eq!(binding_usage.get_binding().get_moduleName().unwrap_string(), escaped_module);
        assert_eq!(binding_usage.get_binding().get_bindingId().unwrap_int(), 9);
        let max_uses = binding_usage.get_maxUses();
        let Maybe::Just(max_uses) = maybe(&max_uses) else { panic!("expected maxUses") };
        assert_eq!(max_uses.unwrap_int(), 3);
        let escaping = binding_usage.get_hasEscapingUseContext();
        let Maybe::Just(escaping) = maybe(&escaping) else { panic!("expected hasEscapingUseContext") };
        assert!(escaping.unwrap_bool());
    }

    // Type entries stay shared with the decoded table; annotations themselves
    // are rebuilt for every distinct input.
    {
        let shared_table = decode_table(&parse("[\"Int\",{\"type\":\"Array\",\"element\":0}]"));
        let first = parse("{\"type\":0}");
        let second = parse("{\"type\":1}");
        let run_first = run_ann(&module, &shared_table, &first);
        let run_second = run_ann(&module, &shared_table, &second);
        assert_eq!(run_first.fallback_calls + run_second.fallback_calls, 0);
        assert!(compare_ann(&run_first, "shared type 0"));
        assert!(compare_ann(&run_second, "shared type 1"));
        let Either::Right(ann_first) = run_first.candidate.as_ref() else { panic!("expected success") };
        let Either::Right(ann_second) = run_second.candidate.as_ref() else { panic!("expected success") };
        let first_entry = type_entry(ann_first);
        let second_entry = type_entry(ann_second);
        let table_first = shared_table.array_get(0).unwrap_class::<Rc<ExprType>>().clone();
        let table_second = shared_table.array_get(1).unwrap_class::<Rc<ExprType>>().clone();
        assert!(Rc::ptr_eq(&first_entry, &table_first), "annotation type 0 must share the table entry");
        assert!(Rc::ptr_eq(&second_entry, &table_second), "annotation type 1 must share the table entry");
        let ExprType::Array(element) = table_second.as_ref() else { panic!("expected Array") };
        assert!(Rc::ptr_eq(&table_first, element), "nested table entries stay shared");
    }
    {
        let input = parse("{\"meta\":{\"metaType\":\"IsNewtype\"}}");
        let first = run_ann(&module, &table, &input);
        let second = run_ann(&module, &table, &input);
        let Either::Right(ann_first) = first.candidate.as_ref() else { panic!("expected success") };
        let Either::Right(ann_second) = second.candidate.as_ref() else { panic!("expected success") };
        let first_meta = meta_entry(ann_first);
        let second_meta = meta_entry(ann_second);
        assert!(!Rc::ptr_eq(&first_meta, &second_meta), "annotation values must not be pooled between inputs");
    }

    // Native FFI representations which JSON text cannot express: Int, genuine
    // negative zero (JSON.stringify would erase it), and non-finite Numbers.
    let numbers = [Value::Int(-2147483649), Value::Int(-2147483648), Value::Int(-1),
        Value::Int(0), Value::Int(1), Value::Int(2147483647), Value::Int(2147483648),
        Value::Int(2147483649), Value::Int(i64::MAX), Value::Number(-0.0),
        Value::Number(f64::INFINITY), Value::Number(f64::NEG_INFINITY), Value::Number(f64::NAN)];
    let mut native_number_cases = 0;
    for value in numbers {
        for (shape, block, field) in [
            ("{}", None, "type"),
            ("{\"bindingUsage\":{\"bindingId\":0}}", Some("bindingUsage"), "bindingId"),
            ("{\"bindingUsage\":{\"bindingId\":0}}", Some("bindingUsage"), "maxUses"),
            ("{\"variableUse\":{\"bindingId\":0}}", Some("variableUse"), "bindingId"),
        ] {
            let input = parse(shape);
            let object = block.map(|key| object_field(&input, key)).unwrap_or_else(|| input.clone());
            drop(object.unwrap_class::<Rc<Object>>().insert(field.to_owned(), value.clone()));
            let run = run_ann(&module, &table, &input);
            let valid = compare_ann(&run, "native numeric representation");
            assert_eq!(run.fallback_calls, if valid { 0 } else { 1 });
            native_number_cases += 1;
        }
    }
    let mut native_array_cases = 0;
    for input in [
        Value::IntArray(Rc::new(vec![-1, 0, 2147483648])),
        Value::NativeArray(Rc::new(NativeArrayOwner::Numbers(vec![-0.0, 0.5, 1.0]))),
        Value::NativeArray(Rc::new(NativeArrayOwner::Booleans(vec![true, false, true]))),
        Value::NativeArray(Rc::new(NativeArrayOwner::Strings(vec!["x".into(), "".into(),
            purust_string_from_utf16(&[0xd800])]))),
    ] {
        for fail_at in [None, Some(0), Some(1), Some(2)] {
            let run = run_array(&input, fail_at);
            assert_eq!(run.fallback_calls, 0);
            assert_eq!(run.candidate_calls, fail_at.map_or(input.array_len(), |i| i + 1));
            assert_eq!(run.candidate_calls, run.reference_calls);
            match (run.candidate.as_ref(), run.reference.as_ref()) {
                (Either::Left(a), Either::Left(b)) => assert!(same_error(a, b)),
                (Either::Right(a), Either::Right(b)) => assert!(eq_json(a, b)),
                _ => panic!("native array representation disagrees"),
            }
            native_array_cases += 1;
        }
    }
    println!("Native representations: {native_number_cases} numeric annotations / {native_array_cases} packed arrays passed");

    // The full fallback receives the original module, table, path and input.
    {
        let fallback_module = purust_string_from_utf8("Args.Module");
        let fallback_table = decode_table(&parse("[\"Int\"]"));
        let fallback_input = parse("{\"meta\":{\"metaType\":\"Bogus\"}}");
        let fallback_path = String::from("args/path");
        let recorded: Rc<Mutex<Option<(String, Value, String, Value)>>> = Rc::new(Mutex::new(None));
        let sink = recorded.clone();
        let fallback = Func4::Shared(Rc::new(move |module: String, table: Value, path: String, input: Value| -> Value {
            *sink.lock().unwrap() = Some((module.clone(), table.clone(), path.clone(), input.clone()));
            Value::Class(Rc::new(PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsagePS(module, table, path, input)))
        }));
        let result = candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsageImpl(
            fallback, fallback_module.clone(), fallback_table.clone(), fallback_path.clone(), fallback_input.clone());
        let recorded = recorded.lock().unwrap().clone().expect("fallback arguments");
        assert_eq!(recorded.0, fallback_module);
        assert_eq!(recorded.2, fallback_path);
        assert!(Rc::ptr_eq(&recorded.1.unwrap_array(), &fallback_table.unwrap_array()));
        assert!(Rc::ptr_eq(recorded.3.unwrap_class::<Rc<Object>>(), fallback_input.unwrap_class::<Rc<Object>>()));
        let reference = PureScript_Backend_Optimizer_CoreFn_Json_decodeAnnWithUsagePS(
            fallback_module, fallback_table, fallback_path, fallback_input);
        let candidate_result = result.unwrap_class::<Rc<Either>>().clone();
        match (candidate_result.as_ref(), reference.as_ref()) {
            (Either::Left(a), Either::Left(b)) => {
                assert!(same_error(a, b));
                assert_eq!(error_string(a), error_string(b));
            }
            _ => panic!("expected matching errors"),
        }
    }

    println!(
        "Native TAST: {arrays_fast} array fast / {arrays_errors} array errors / {arrays_non_arrays} non-array fallbacks; \
{annotations_fast} annotations fast / {annotations_fallback} fallback; corpus {corpus_modules} modules / {corpus_annotations} annotations \
({corpus_native} native, {corpus_errors} errors, {corpus_declined} declined); exact values, errors, ownership and sharing passed"
    );
}
