#![allow(warnings)]
// Differential harness for the native decodeModule fast path. The candidate
// (source FFI injected by test-native-tast-module.mjs) is compared to the
// validated PureScript decoder on whole corefn modules, on generated boundary
// modules (valid, validate-failure and malformed) and on the frozen corpus.
// Every comparison checks the exact error tree for Left and a full structural
// equality for Right; the counters prove which path ran and that validate is
// invoked exactly once on the native path.
use purust_core::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc as Rc;
use Purs_Data_Argonaut_Decode_Error::{JsonDecodeError, Data_Argonaut_Decode_Error_printJsonDecodeError};
use Purs_Data_Either::Either;
use Purs_Data_Maybe::Maybe;
use Purs_PureScript_Backend_Optimizer_CoreFn::*;
use Purs_PureScript_Backend_Optimizer_CoreFn_Json::*;
use Purs_PureScript_Backend_Optimizer_CoreFn_Usage::*;

mod candidate {
    use super::*;
    use purust_core::*;
    use Purs_PureScript_Backend_Optimizer_CoreFn_Json::*;
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
            let x = a.unwrap_class::<Rc<Purs_Foreign_Object::Object>>().entries();
            let y = b.unwrap_class::<Rc<Purs_Foreign_Object::Object>>().entries();
            x.len() == y.len() && x.iter().zip(y.iter()).all(|((kx, vx), (ky, vy))| kx == ky && eq_json(vx, vy))
        }
        _ => false,
    }
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
            let eq = PureScript_Backend_Optimizer_CoreFn_eqMeta();
            (eq.eq)(x.clone(), y.clone())
        }
        _ => false,
    }
}

fn eq_type_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            let eq = PureScript_Backend_Optimizer_CoreFn_eqExprType();
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

fn eq_binding_id(a: &Value, b: &Value) -> bool {
    eq_string_value(&a.get_moduleName(), &b.get_moduleName())
        && a.get_bindingId().unwrap_int() == b.get_bindingId().unwrap_int()
}

fn eq_binding_usage_maybe(a: &Value, b: &Value) -> bool {
    match (maybe(a), maybe(b)) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => {
            eq_binding_id(&x.get_binding(), &y.get_binding())
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
            eq_binding_id(&x.get_binding(), &y.get_binding())
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

fn eq_string_value(a: &Value, b: &Value) -> bool {
    a.unwrap_string() == b.unwrap_string()
}

fn eq_string_array(a: &Value, b: &Value) -> bool {
    a.array_len() == b.array_len()
        && (0..a.array_len()).all(|index| eq_string_value(&a.array_get(index), &b.array_get(index)))
}

fn eq_array(a: &Value, b: &Value, eq: &dyn Fn(&Value, &Value) -> bool) -> bool {
    a.array_len() == b.array_len()
        && (0..a.array_len()).all(|index| eq(&a.array_get(index), &b.array_get(index)))
}

fn eq_expr_type_value(a: &Value, b: &Value) -> bool {
    let eq = PureScript_Backend_Optimizer_CoreFn_eqExprType();
    (eq.eq)(a.clone(), b.clone())
}

fn eq_type_array(a: &Value, b: &Value) -> bool {
    a.array_len() == b.array_len()
        && (0..a.array_len()).all(|index| eq_expr_type_value(&a.array_get(index), &b.array_get(index)))
}

fn eq_expr_type_arc(a: &Rc<ExprType>, b: &Rc<ExprType>) -> bool {
    eq_expr_type_value(&Value::Class(Rc::new(a.clone())), &Value::Class(Rc::new(b.clone())))
}

fn eq_maybe_string(a: &Rc<Maybe>, b: &Rc<Maybe>) -> bool {
    match (a.as_ref(), b.as_ref()) {
        (Maybe::Nothing, Maybe::Nothing) => true,
        (Maybe::Just(x), Maybe::Just(y)) => x.unwrap_string() == y.unwrap_string(),
        _ => false,
    }
}

fn eq_qualified(a: &Qualified, b: &Qualified) -> bool {
    match (a, b) {
        (Qualified::Qualified(a0, a1), Qualified::Qualified(b0, b1)) => {
            eq_maybe_string(a0, b0) && eq_string_value(a1, b1)
        }
    }
}

fn eq_prop(a: &Value, b: &Value, eq_item: &dyn Fn(&Value, &Value) -> bool) -> bool {
    match (a.unwrap_class::<Rc<Prop>>().as_ref(), b.unwrap_class::<Rc<Prop>>().as_ref()) {
        (Prop::Prop(ka, va), Prop::Prop(kb, vb)) => ka == kb && eq_item(va, vb),
        _ => false,
    }
}

fn eq_literal(a: &Literal, b: &Literal, eq_item: &dyn Fn(&Value, &Value) -> bool) -> bool {
    match (a, b) {
        (Literal::LitInt(x), Literal::LitInt(y)) => x == y,
        (Literal::LitNumber(x), Literal::LitNumber(y)) => x.to_bits() == y.to_bits(),
        (Literal::LitString(x), Literal::LitString(y)) => x == y,
        (Literal::LitChar(x), Literal::LitChar(y)) => x == y,
        (Literal::LitBoolean(x), Literal::LitBoolean(y)) => x == y,
        (Literal::LitArray(x), Literal::LitArray(y)) => eq_array(x, y, eq_item),
        (Literal::LitRecord(x), Literal::LitRecord(y)) => eq_array(x, y, &|p, q| eq_prop(p, q, eq_item)),
        _ => false,
    }
}

fn eq_expr(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Expr>>().as_ref(), b.unwrap_class::<Rc<Expr>>().as_ref()) {
        (Expr::ExprVar(a0, a1), Expr::ExprVar(b0, b1)) => eq_ann(a0, b0) && eq_qualified(a1, b1),
        (Expr::ExprLit(a0, a1), Expr::ExprLit(b0, b1)) => eq_ann(a0, b0) && eq_literal(a1, b1, &eq_expr),
        (Expr::ExprConstructor(a0, a1, a2, a3), Expr::ExprConstructor(b0, b1, b2, b3)) => {
            eq_ann(a0, b0) && a1 == b1 && a2 == b2 && eq_string_array(a3, b3)
        }
        (Expr::ExprAccessor(a0, a1, a2), Expr::ExprAccessor(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_expr_arc(a1, b1) && a2 == b2
        }
        (Expr::ExprUpdate(a0, a1, a2), Expr::ExprUpdate(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_expr_arc(a1, b1) && eq_array(a2, b2, &|p, q| eq_prop(p, q, &eq_expr))
        }
        (Expr::ExprAbs(a0, a1, a2), Expr::ExprAbs(b0, b1, b2)) => {
            eq_ann(a0, b0) && a1 == b1 && eq_expr_arc(a2, b2)
        }
        (Expr::ExprApp(a0, a1, a2), Expr::ExprApp(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_expr_arc(a1, b1) && eq_expr_arc(a2, b2)
        }
        (Expr::ExprCase(a0, a1, a2), Expr::ExprCase(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_array(a1, b1, &eq_expr) && eq_array(a2, b2, &eq_alternative)
        }
        (Expr::ExprLet(a0, a1, a2), Expr::ExprLet(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_array(a1, b1, &eq_bind) && eq_expr_arc(a2, b2)
        }
        (Expr::ExprTypeApp(a0, a1, a2), Expr::ExprTypeApp(b0, b1, b2)) => {
            eq_ann(a0, b0) && eq_expr_arc(a1, b1) && eq_expr_type_arc(a2, b2)
        }
        _ => false,
    }
}

fn eq_expr_arc(a: &Rc<Expr>, b: &Rc<Expr>) -> bool {
    eq_expr(
        &Value::Class(Rc::new(a.clone())),
        &Value::Class(Rc::new(b.clone())),
    )
}

fn eq_binder(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Binder>>().as_ref(), b.unwrap_class::<Rc<Binder>>().as_ref()) {
        (Binder::BinderNull(a0), Binder::BinderNull(b0)) => eq_ann(a0, b0),
        (Binder::BinderVar(a0, a1), Binder::BinderVar(b0, b1)) => eq_ann(a0, b0) && a1 == b1,
        (Binder::BinderNamed(a0, a1, a2), Binder::BinderNamed(b0, b1, b2)) => {
            eq_ann(a0, b0) && a1 == b1 && eq_binder_arc(a2, b2)
        }
        (Binder::BinderLit(a0, a1), Binder::BinderLit(b0, b1)) => {
            eq_ann(a0, b0) && eq_literal(a1, b1, &eq_binder)
        }
        (Binder::BinderConstructor(a0, a1, a2, a3), Binder::BinderConstructor(b0, b1, b2, b3)) => {
            eq_ann(a0, b0) && eq_qualified(a1, b1) && eq_qualified(a2, b2) && eq_array(a3, b3, &eq_binder)
        }
        _ => false,
    }
}

fn eq_binder_arc(a: &Rc<Binder>, b: &Rc<Binder>) -> bool {
    eq_binder(&Value::Class(Rc::new(a.clone())), &Value::Class(Rc::new(b.clone())))
}

fn eq_binding(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Binding>>().as_ref(), b.unwrap_class::<Rc<Binding>>().as_ref()) {
        (Binding::Binding(a0, a1, a2), Binding::Binding(b0, b1, b2)) => {
            eq_ann(a0, b0) && a1 == b1 && eq_expr_arc(a2, b2)
        }
        _ => false,
    }
}

fn eq_bind(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Bind>>().as_ref(), b.unwrap_class::<Rc<Bind>>().as_ref()) {
        (Bind::NonRec(a0), Bind::NonRec(b0)) => {
            eq_binding(&Value::Class(Rc::new(a0.clone())), &Value::Class(Rc::new(b0.clone())))
        }
        (Bind::Rec(a0), Bind::Rec(b0)) => eq_array(a0, b0, &eq_binding),
        _ => false,
    }
}

fn eq_guard(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Guard>>().as_ref(), b.unwrap_class::<Rc<Guard>>().as_ref()) {
        (Guard::Guard(a0, a1), Guard::Guard(b0, b1)) => eq_expr_arc(a0, b0) && eq_expr_arc(a1, b1),
        _ => false,
    }
}

fn eq_alternative(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<CaseAlternative>>().as_ref(), b.unwrap_class::<Rc<CaseAlternative>>().as_ref()) {
        (CaseAlternative::CaseAlternative(a0, a1), CaseAlternative::CaseAlternative(b0, b1)) => {
            eq_array(a0, b0, &eq_binder) && eq_case_guard(a1.as_ref(), b1.as_ref())
        }
        _ => false,
    }
}

fn eq_case_guard(a: &CaseGuard, b: &CaseGuard) -> bool {
    match (a, b) {
        (CaseGuard::Guarded(x), CaseGuard::Guarded(y)) => eq_array(x, y, &eq_guard),
        (CaseGuard::Unconditional(x), CaseGuard::Unconditional(y)) => eq_expr_arc(x, y),
        _ => false,
    }
}

fn eq_import(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Import>>().as_ref(), b.unwrap_class::<Rc<Import>>().as_ref()) {
        (Import::Import(a0, a1), Import::Import(b0, b1)) => eq_ann(a0, b0) && a1 == b1,
        _ => false,
    }
}

fn eq_re_export(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<ReExport>>().as_ref(), b.unwrap_class::<Rc<ReExport>>().as_ref()) {
        (ReExport::ReExport(a0, a1), ReExport::ReExport(b0, b1)) => a0 == b0 && a1 == b1,
        _ => false,
    }
}

fn eq_comment(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Comment>>().as_ref(), b.unwrap_class::<Rc<Comment>>().as_ref()) {
        (Comment::LineComment(x), Comment::LineComment(y)) => x == y,
        (Comment::BlockComment(x), Comment::BlockComment(y)) => x == y,
        _ => false,
    }
}

fn eq_data_constructor(a: &Value, b: &Value) -> bool {
    eq_string_value(&a.get_name(), &b.get_name()) && eq_type_array(&a.get_fields(), &b.get_fields())
}

fn eq_data_decl(a: &Value, b: &Value) -> bool {
    eq_string_value(&a.get_name(), &b.get_name())
        && eq_string_array(&a.get_vars(), &b.get_vars())
        && eq_array(&a.get_constructors(), &b.get_constructors(), &eq_data_constructor)
}

fn eq_method(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Purs_Data_Tuple::Tuple>>().as_ref(), b.unwrap_class::<Rc<Purs_Data_Tuple::Tuple>>().as_ref()) {
        (Purs_Data_Tuple::Tuple::Tuple(a0, a1), Purs_Data_Tuple::Tuple::Tuple(b0, b1)) => {
            eq_string_value(a0, b0) && eq_expr_type_value(a1, b1)
        }
        _ => false,
    }
}

fn eq_constraint(a: &Value, b: &Value) -> bool {
    match (a.unwrap_class::<Rc<Purs_Data_Tuple::Tuple>>().as_ref(), b.unwrap_class::<Rc<Purs_Data_Tuple::Tuple>>().as_ref()) {
        (Purs_Data_Tuple::Tuple::Tuple(a0, a1), Purs_Data_Tuple::Tuple::Tuple(b0, b1)) => {
            eq_string_array(a0, b0) && eq_type_array(a1, b1)
        }
        _ => false,
    }
}

fn eq_class_decl(a: &Value, b: &Value) -> bool {
    eq_string_value(&a.get_name(), &b.get_name())
        && eq_string_array(&a.get_vars(), &b.get_vars())
        && eq_array(&a.get_superclasses(), &b.get_superclasses(), &eq_constraint)
        && eq_array(&a.get_methods(), &b.get_methods(), &eq_method)
}

fn foreign_entries(map: &Value) -> Vec<(String, Value)> {
    let map = map.unwrap_class::<Rc<Purs_Data_Map_Internal::Map>>().clone();
    let entries = Purs_Data_Map_Internal::Data_Map_Internal_toUnfoldableUnordered(
        Purs_Data_Unfoldable::Data_Unfoldable_unfoldableArray(), map);
    let mut out = Vec::with_capacity(entries.array_len());
    for index in 0..entries.array_len() {
        let item = entries.array_get(index);
        match item.unwrap_class::<Rc<Purs_Data_Tuple::Tuple>>().as_ref() {
            Purs_Data_Tuple::Tuple::Tuple(key, value) => out.push((key.unwrap_string(), value.clone())),
            _ => unreachable!(),
        }
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}

fn eq_foreign(a: &Value, b: &Value) -> bool {
    let a = foreign_entries(a);
    let b = foreign_entries(b);
    a.len() == b.len()
        && a.iter().zip(b.iter()).all(|((ka, va), (kb, vb))| ka == kb && eq_type_maybe(va, vb))
}

fn eq_module(a: &Value, b: &Value) -> bool {
    eq_string_value(&a.get_name(), &b.get_name())
        && eq_string_value(&a.get_path(), &b.get_path())
        && eq_span(&a.get_span(), &b.get_span())
        && eq_array(&a.get_imports(), &b.get_imports(), &eq_import)
        && eq_string_array(&a.get_exports(), &b.get_exports())
        && eq_array(&a.get_reExports(), &b.get_reExports(), &eq_re_export)
        && eq_array(&a.get_dataDecls(), &b.get_dataDecls(), &eq_data_decl)
        && eq_array(&a.get_classDecls(), &b.get_classDecls(), &eq_class_decl)
        && eq_array(&a.get_decls(), &b.get_decls(), &eq_bind)
        && eq_foreign(&a.get_foreign(), &b.get_foreign())
        && eq_array(&a.get_comments(), &b.get_comments(), &eq_comment)
}

struct Run {
    candidate: Rc<Either>,
    reference: Rc<Either>,
    fallbacks: usize,
    validates: usize,
}

fn run(input: &Value) -> Run {
    let fallback_calls = Rc::new(AtomicUsize::new(0));
    let fallback_counter = fallback_calls.clone();
    let fallback = Func1::Shared(Rc::new(move |value: Value| -> Value {
        fallback_counter.fetch_add(1, Ordering::SeqCst);
        Value::Class(Rc::new(PureScript_Backend_Optimizer_CoreFn_Json_decodeModulePS(value)))
    }));
    let validate_calls = Rc::new(AtomicUsize::new(0));
    let validate_counter = validate_calls.clone();
    let validate = Func1::Shared(Rc::new(move |module: Value| -> Rc<Either> {
        validate_counter.fetch_add(1, Ordering::SeqCst);
        PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModule(module)
    }));
    let candidate_value = candidate::PureScript_Backend_Optimizer_CoreFn_Json_decodeModuleImpl(
        fallback, validate, input.clone());
    let candidate = candidate_value.unwrap_class::<Rc<Either>>().clone();
    let reference = PureScript_Backend_Optimizer_CoreFn_Json_decodeModulePS(input.clone());
    Run {
        candidate,
        reference,
        fallbacks: fallback_calls.load(Ordering::SeqCst),
        validates: validate_calls.load(Ordering::SeqCst),
    }
}

fn compare(run: &Run, context: &str) -> bool {
    match (run.candidate.as_ref(), run.reference.as_ref()) {
        (Either::Left(a), Either::Left(b)) => {
            assert!(same_error(a, b), "{context}: different error trees");
            assert_eq!(error_string(a), error_string(b), "{context}");
            false
        }
        (Either::Right(a), Either::Right(b)) => {
            assert!(eq_module(a, b), "{context}: decoded modules differ");
            true
        }
        (Either::Left(a), Either::Right(_)) => panic!("{context}: unexpected error {}", error_string(a)),
        (Either::Right(_), Either::Left(b)) => panic!("{context}: missed error {}", error_string(b)),
    }
}

fn boundary<'a>(lines: &'a str, wanted: &str) -> Value {
    for line in lines.lines() {
        let mut cells = line.splitn(3, '\t');
        let _mode = cells.next().unwrap_or("");
        let name = cells.next().unwrap_or("");
        if name != wanted { continue; }
        return parse(cells.next().unwrap());
    }
    panic!("missing boundary {wanted}");
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    assert_eq!(args.len(), 3, "Usage: purust_native_tast_module_test MODULES BOUNDARIES");
    let modules_text = std::fs::read_to_string(&args[1]).unwrap();
    let boundaries_text = std::fs::read_to_string(&args[2]).unwrap();

    let mut modules = 0usize;
    for (number, line) in modules_text.lines().enumerate() {
        if line.is_empty() { continue; }
        let input = parse(line);
        let run = run(&input);
        let context = format!("frozen module {number}");
        assert!(compare(&run, &context), "{context}: expected a successful decode");
        assert_eq!(run.fallbacks, 0, "{context}: a valid module declined the native path");
        assert_eq!(run.validates, 1, "{context}: validate must run exactly once");
        modules += 1;
    }
    assert!(modules > 0, "no frozen modules");

    let mut fast = 0usize;
    let mut fallback = 0usize;
    let mut validated = 0usize;
    for (number, line) in boundaries_text.lines().enumerate() {
        if line.is_empty() { continue; }
        let mut cells = line.splitn(3, '\t');
        let mode = cells.next().unwrap();
        let name = cells.next().unwrap();
        let input = parse(cells.next().unwrap());
        let run = run(&input);
        let context = format!("boundary {number} ({name}, {mode})");
        let right = compare(&run, &context);
        match mode {
            "fast" => {
                assert_eq!(run.fallbacks, 0, "{context}: expected the native fast path");
                assert_eq!(run.validates, 1, "{context}: validate must run exactly once");
                assert!(right, "{context}: expected a successful decode");
                fast += 1;
            }
            "validate" => {
                assert_eq!(run.fallbacks, 0, "{context}: expected the native fast path");
                assert_eq!(run.validates, 1, "{context}: validate must run exactly once");
                assert!(!right, "{context}: expected the validate error");
                validated += 1;
            }
            "fallback" => {
                assert_eq!(run.fallbacks, 1, "{context}: expected exactly one fallback");
                assert_eq!(run.validates, 0, "{context}: declined input must never reach validate");
                assert!(!right, "{context}: invalid fixture unexpectedly succeeded");
                fallback += 1;
            }
            "either" => {}
            other => panic!("boundary {number}: unknown mode {other}"),
        }
    }

    // The module span is preserved even though annotations use emptySpan.
    {
        let input = boundary(&boundaries_text, "valid-minimal");
        let run = run(&input);
        assert_eq!(run.fallbacks, 0, "valid-minimal must stay native");
        let Either::Right(module) = run.candidate.as_ref() else { panic!("valid-minimal must decode") };
        assert_eq!(module.get_path().unwrap_string(), purust_string_from_utf8("src/Test/Valid.purs"));
        let span = module.get_span();
        assert_eq!(span.get_path().unwrap_string(), purust_string_from_utf8("src/Test/Valid.purs"));
        assert_eq!(span.get_start().get_line().unwrap_int(), 3);
        assert_eq!(span.get_start().get_column().unwrap_int(), 4);
        assert_eq!(span.get_end().get_line().unwrap_int(), 9);
        assert_eq!(span.get_end().get_column().unwrap_int(), 7);
        // Annotation spans are ignored and stay empty.
        let first = module.get_decls().array_get(0);
        let annotation = match first.unwrap_class::<Rc<Bind>>().as_ref() {
            Bind::NonRec(binding) => match binding.as_ref() {
                Binding::Binding(ann, _, _) => ann.clone(),
                _ => unreachable!(),
            },
            _ => unreachable!(),
        };
        assert_eq!(annotation.get_span().get_path().unwrap_string(), purust_string_from_utf8("<internal>"));
        assert_eq!(annotation.get_span().get_start().get_line().unwrap_int(), 0);
    }

    // Type table entries must stay shared with every annotation and ExprTypeApp.
    {
        let input = boundary(&boundaries_text, "valid-sharing");
        let run = run(&input);
        assert_eq!(run.fallbacks, 0, "valid-sharing must stay native");
        let Either::Right(module) = run.candidate.as_ref() else { panic!("valid-sharing must decode") };
        let annotation_type = |index: usize| -> Rc<ExprType> {
            let bind = module.get_decls().array_get(index);
            let annotation = match bind.unwrap_class::<Rc<Bind>>().as_ref() {
                Bind::NonRec(binding) => match binding.as_ref() {
                    Binding::Binding(ann, _, _) => ann.clone(),
                    _ => unreachable!(),
                },
                _ => unreachable!(),
            };
            match maybe(&annotation.get_type_kw()) {
                Maybe::Just(entry) => entry.unwrap_class::<Rc<ExprType>>().clone(),
                Maybe::Nothing => panic!("annotation has no type"),
            }
        };
        let first = annotation_type(0);
        let second = annotation_type(1);
        assert!(Rc::ptr_eq(&first, &second), "annotations must share one table entry");
        let second_bind = module.get_decls().array_get(1);
        let expression = match second_bind.unwrap_class::<Rc<Bind>>().as_ref() {
            Bind::NonRec(binding) => match binding.as_ref() {
                Binding::Binding(_, _, expression) => expression.clone(),
                _ => unreachable!(),
            },
            _ => unreachable!(),
        };
        let type_app = match expression.as_ref() {
            Expr::ExprTypeApp(_, _, ty) => ty.clone(),
            _ => panic!("expected ExprTypeApp"),
        };
        assert!(Rc::ptr_eq(&first, &type_app), "ExprTypeApp must share the table entry");
    }

    println!(
        "Native TAST module: {modules} frozen modules fast; {fast} boundary fast / {validated} validate failures / \
{fallback} fallbacks; exact errors, module spans and shared type entries passed"
    );
}
