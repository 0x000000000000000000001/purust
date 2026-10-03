#![allow(warnings)]
// Differential harness for the native source-usage validator. The candidate
// (source FFI injected by test-native-source-usage.mjs) is compared with the
// validated PureScript `validateSourceUsageModulePS` on synthetic modules that
// reach every branch, every error and the exact first-error order, and on the
// frozen TAST corpus. Every comparison checks the `TypeMismatch` shape and the
// printed message; counters prove which path ran.
use purust_core::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc as Rc;
use perceus_ptr::PerceusPtr;
use Purs_Data_Argonaut_Decode_Error::{
    Data_Argonaut_Decode_Error_printJsonDecodeError, JsonDecodeError,
};
use Purs_Data_Either::Either;
use Purs_Data_Maybe::Maybe;
use Purs_PureScript_Backend_Optimizer_CoreFn::*;
use Purs_PureScript_Backend_Optimizer_CoreFn_Json::*;
use Purs_PureScript_Backend_Optimizer_CoreFn_Usage::*;

mod candidate {
    use purust_core::*;
    // NATIVE_FFI
}

// ---------------------------------------------------------------------------
// Value builders for the exact decoder representations.

fn string(text: &str) -> Value {
    Value::String(purust_string_from_utf8(text))
}

fn maybe(value: Option<Value>) -> Value {
    let payload = match value {
        Some(value) => Maybe::Just(value),
        None => Maybe::Nothing,
    };
    Value::Class(Rc::new(Rc::new(payload)))
}

fn boxed<T: std::any::Any + Send + Sync + 'static>(value: T) -> Value {
    Value::Class(Rc::new(Rc::new(value)))
}

// Box an existing Rc<Node> so `unwrap_class`/`downcast_ref::<Rc<Node>>` sees
// the node allocation itself, exactly like the decoder's box_* helpers.
fn boxed_rc<T: std::any::Any + Send + Sync + 'static>(value: Rc<T>) -> Value {
    Value::Class(Rc::new(value))
}

fn source_id(module: &str, id: i64) -> Value {
    Value::Record_bindingId_moduleName(PerceusPtr::new(purust_core::Record_bindingId_moduleName {
        moduleName: Some(string(module)),
        bindingId: Some(Value::Int(id)),
    }))
}

fn binding_usage(module: &str, id: i64) -> Value {
    Value::Record_binding_hasEscapingUseContext_maxUses(PerceusPtr::new(
        purust_core::Record_binding_hasEscapingUseContext_maxUses {
            binding: Some(source_id(module, id)),
            maxUses: Some(maybe(None)),
            hasEscapingUseContext: Some(maybe(None)),
        },
    ))
}

fn variable_use(module: &str, id: i64) -> Value {
    Value::Record_binding_lastLocalUse(PerceusPtr::new(purust_core::Record_binding_lastLocalUse {
        binding: Some(source_id(module, id)),
        lastLocalUse: Some(maybe(None)),
    }))
}

fn ann_source(source_usage: Value) -> Value {
    Value::Record_meta_sourceUsage_span_type_kw(PerceusPtr::new(
        purust_core::Record_meta_sourceUsage_span_type_kw {
            span: Some(PureScript_Backend_Optimizer_CoreFn_emptySpan()),
            meta: Some(maybe(None)),
            type_kw: Some(maybe(None)),
            sourceUsage: Some(source_usage),
        },
    ))
}

fn ann() -> Value {
    ann_source(maybe(None))
}

fn usage_value(binding_usage_field: Option<Value>, variable_use_field: Option<Value>) -> Value {
    Value::Record_bindingUsage_variableUse(PerceusPtr::new(
        purust_core::Record_bindingUsage_variableUse {
            bindingUsage: Some(maybe(binding_usage_field)),
            variableUse: Some(maybe(variable_use_field)),
        },
    ))
}

fn ann_full(binding: Option<(&str, i64)>, variable: Option<(&str, i64)>) -> Value {
    let binding_usage_field = binding.map(|(module, id)| binding_usage(module, id));
    let variable_use_field = variable.map(|(module, id)| variable_use(module, id));
    ann_source(maybe(Some(usage_value(binding_usage_field, variable_use_field))))
}

fn ann_binding(module: &str, id: i64) -> Value {
    ann_full(Some((module, id)), None)
}

fn ann_variable(module: &str, id: i64) -> Value {
    ann_full(None, Some((module, id)))
}

// `sourceUsage = Just { bindingUsage: Nothing, variableUse: Nothing }` is the
// same empty usage as `sourceUsage = Nothing`.
fn ann_empty_just() -> Value {
    ann_source(maybe(Some(usage_value(None, None))))
}

fn record_a(fields: Vec<(&str, Value)>) -> Value {
    Value::Record_a(PerceusPtr::new(purust_core::Record_a::from_fields(fields)))
}

fn import(annotation: Value) -> Value {
    boxed(Import::Import(annotation, purust_string_from_utf8("Data.Maybe")))
}

fn module(name: &str, imports: Vec<Value>, decls: Vec<Value>) -> Value {
    Value::Record_classDecls_comments_dataDecls_decls_exports_foreign_imports_name_path_reExports_span(
        PerceusPtr::new(
            purust_core::Record_classDecls_comments_dataDecls_decls_exports_foreign_imports_name_path_reExports_span {
                name: Some(string(name)),
                imports: Some(mk_array(imports)),
                decls: Some(mk_array(decls)),
                ..Default::default()
            },
        ),
    )
}

fn binding(annotation: Value, ident: &str, expression: Rc<Expr>) -> Rc<Binding> {
    Rc::new(Binding::Binding(annotation, purust_string_from_utf8(ident), expression))
}

fn bind_nonrec(annotation: Value, ident: &str, expression: Rc<Expr>) -> Value {
    boxed(Bind::NonRec(binding(annotation, ident, expression)))
}

fn bind_rec(items: Vec<(Value, &str, Rc<Expr>)>) -> Value {
    let binds = items
        .into_iter()
        .map(|(annotation, ident, expression)| boxed_rc(binding(annotation, ident, expression)))
        .collect();
    boxed(Bind::Rec(mk_array(binds)))
}

fn var(annotation: Value, module_name: Option<&str>, ident: &str) -> Rc<Expr> {
    let module = match module_name {
        Some(name) => Maybe::Just(string(name)),
        None => Maybe::Nothing,
    };
    Rc::new(Expr::ExprVar(
        annotation,
        Rc::new(Qualified::Qualified(Rc::new(module), string(ident))),
    ))
}

fn abs(annotation: Value, ident: &str, body: Rc<Expr>) -> Rc<Expr> {
    Rc::new(Expr::ExprAbs(annotation, purust_string_from_utf8(ident), body))
}

fn literal_expr(annotation: Value, literal: Literal) -> Rc<Expr> {
    Rc::new(Expr::ExprLit(annotation, Rc::new(literal)))
}

fn constructor_expr(annotation: Value) -> Rc<Expr> {
    Rc::new(Expr::ExprConstructor(
        annotation,
        purust_string_from_utf8("T"),
        purust_string_from_utf8("C"),
        mk_array(vec![]),
    ))
}

fn accessor(annotation: Value, expression: Rc<Expr>, field: &str) -> Rc<Expr> {
    Rc::new(Expr::ExprAccessor(annotation, expression, purust_string_from_utf8(field)))
}

fn update(annotation: Value, expression: Rc<Expr>, fields: Vec<(&str, Rc<Expr>)>) -> Rc<Expr> {
    let props = fields
        .into_iter()
        .map(|(key, value)| boxed(Prop::Prop(purust_string_from_utf8(key), boxed_rc(value))))
        .collect();
    Rc::new(Expr::ExprUpdate(annotation, expression, mk_array(props)))
}

fn app(annotation: Value, abstraction: Rc<Expr>, argument: Rc<Expr>) -> Rc<Expr> {
    Rc::new(Expr::ExprApp(annotation, abstraction, argument))
}

fn case_expr(annotation: Value, values: Vec<Rc<Expr>>, alternatives: Vec<Value>) -> Rc<Expr> {
    Rc::new(Expr::ExprCase(
        annotation,
        mk_array(values.into_iter().map(boxed_rc).collect()),
        mk_array(alternatives),
    ))
}

fn let_expr(annotation: Value, group: Value, body: Rc<Expr>) -> Rc<Expr> {
    Rc::new(Expr::ExprLet(annotation, mk_array(vec![group]), body))
}

fn type_app(annotation: Value, expression: Rc<Expr>) -> Rc<Expr> {
    Rc::new(Expr::ExprTypeApp(annotation, expression, Rc::new(ExprType::Int)))
}

fn expr_array(items: Vec<Rc<Expr>>) -> Value {
    mk_array(items.into_iter().map(boxed_rc).collect())
}

fn alternative(patterns: Vec<Value>, result: CaseGuard) -> Value {
    boxed_rc(Rc::new(CaseAlternative::CaseAlternative(mk_array(patterns), Rc::new(result))))
}

fn guard(condition: Rc<Expr>, expression: Rc<Expr>) -> Value {
    boxed_rc(Rc::new(Guard::Guard(condition, expression)))
}

fn unconditional(expression: Rc<Expr>) -> CaseGuard {
    CaseGuard::Unconditional(expression)
}

fn guarded(guards: Vec<Value>) -> CaseGuard {
    CaseGuard::Guarded(mk_array(guards))
}

fn literal_array(items: Vec<Rc<Expr>>) -> Literal {
    Literal::LitArray(expr_array(items))
}

fn literal_record(fields: Vec<(&str, Rc<Expr>)>) -> Literal {
    Literal::LitRecord(mk_array(
        fields
            .into_iter()
            .map(|(key, value)| boxed(Prop::Prop(purust_string_from_utf8(key), boxed_rc(value))))
            .collect(),
    ))
}

fn binder_literal_array(items: Vec<Rc<Binder>>) -> Literal {
    Literal::LitArray(mk_array(items.into_iter().map(binder_value).collect()))
}

fn binder_literal_record(fields: Vec<(&str, Rc<Binder>)>) -> Literal {
    Literal::LitRecord(mk_array(
        fields
            .into_iter()
            .map(|(key, value)| {
                boxed(Prop::Prop(purust_string_from_utf8(key), binder_value(value)))
            })
            .collect(),
    ))
}

fn binder_value(binder: Rc<Binder>) -> Value {
    boxed_rc(binder)
}

fn binder_null(annotation: Value) -> Rc<Binder> {
    Rc::new(Binder::BinderNull(annotation))
}

fn binder_var(annotation: Value, ident: &str) -> Rc<Binder> {
    Rc::new(Binder::BinderVar(annotation, purust_string_from_utf8(ident)))
}

fn binder_named(annotation: Value, ident: &str, inner: Rc<Binder>) -> Rc<Binder> {
    Rc::new(Binder::BinderNamed(annotation, purust_string_from_utf8(ident), inner))
}

fn binder_constructor(annotation: Value, patterns: Vec<Rc<Binder>>) -> Rc<Binder> {
    let name = Rc::new(Qualified::Qualified(Rc::new(Maybe::Nothing), string("C")));
    Rc::new(Binder::BinderConstructor(
        annotation,
        name.clone(),
        name,
        mk_array(patterns.into_iter().map(binder_value).collect()),
    ))
}

fn binder_literal(annotation: Value, literal: Literal) -> Rc<Binder> {
    Rc::new(Binder::BinderLit(annotation, Rc::new(literal)))
}

// ---------------------------------------------------------------------------
// Differential runner and assertions.

struct Run {
    native: Rc<Either>,
    ps: Rc<Either>,
    wrapper: Rc<Either>,
    fallbacks: usize,
}

fn run(module: &Value) -> Run {
    let fallback_calls = Rc::new(AtomicUsize::new(0));
    let counter = fallback_calls.clone();
    let fallback = Func1::Shared(Rc::new(move |module: Value| -> Rc<Either> {
        counter.fetch_add(1, Ordering::SeqCst);
        PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModulePS(module)
    }));
    let native = candidate::PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModuleImpl(
        fallback,
        module.clone(),
    );
    let ps = PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModulePS(module.clone());
    let wrapper =
        PureScript_Backend_Optimizer_CoreFn_Usage_validateSourceUsageModule(module.clone());
    Run { native, ps, wrapper, fallbacks: fallback_calls.load(Ordering::SeqCst) }
}

fn error_message(value: &Value) -> &str {
    match value.unwrap_class::<Rc<JsonDecodeError>>().as_ref() {
        JsonDecodeError::TypeMismatch(message) => message,
        _ => panic!("expected a TypeMismatch"),
    }
}

fn print_error(value: &Value) -> String {
    Data_Argonaut_Decode_Error_printJsonDecodeError(
        value.unwrap_class::<Rc<JsonDecodeError>>().clone(),
    )
}

fn assert_same_outcome(name: &str, left: &Either, right: &Either) {
    match (left, right) {
        (Either::Left(left), Either::Left(right)) => {
            assert_eq!(error_message(left), error_message(right), "{name}: errors differ")
        }
        (Either::Right(left), Either::Right(right)) => {
            left.unwrap_unit();
            right.unwrap_unit();
        }
        _ => panic!("{name}: outcomes differ"),
    }
}

fn assert_accepts(name: &str, module: &Value) {
    let run = run(module);
    assert_eq!(run.fallbacks, 0, "{name}: the native path delegated to the fallback");
    assert_same_outcome(name, run.native.as_ref(), run.ps.as_ref());
    assert_same_outcome(name, run.wrapper.as_ref(), run.ps.as_ref());
    match run.native.as_ref() {
        Either::Right(_) => {}
        Either::Left(error) => panic!("{name}: native rejected a valid module: {}", print_error(error)),
    }
}

fn assert_rejects(name: &str, module: &Value, message: &str) {
    let run = run(module);
    assert_eq!(run.fallbacks, 0, "{name}: usage errors must stay native");
    let native = match run.native.as_ref() {
        Either::Left(error) => error_message(error).to_owned(),
        Either::Right(_) => panic!("{name}: native accepted an invalid module"),
    };
    let ps = match run.ps.as_ref() {
        Either::Left(error) => error_message(error).to_owned(),
        Either::Right(_) => panic!("{name}: PureScript accepted an invalid module"),
    };
    assert_eq!(native, ps, "{name}: native and PureScript disagree");
    assert_eq!(native, message, "{name}: wrong first error");
    assert_same_outcome(name, run.wrapper.as_ref(), run.ps.as_ref());
}

fn assert_fallback(name: &str, module: &Value) {
    let run = run(module);
    assert_eq!(run.fallbacks, 1, "{name}: the unsupported shape must delegate exactly once");
    assert_same_outcome(name, run.native.as_ref(), run.ps.as_ref());
}

// ---------------------------------------------------------------------------
// Synthetic fixtures.

const M: &str = "Usage.Fixture";
// Synthetic Unicode text always crosses `purust_string_from_utf8` once, like
// the runtime's UTF-16 code-unit encoding.
const U: &str = "Usage.É😀";

fn unicode_accepts() -> Value {
    module(
        U,
        vec![],
        vec![bind_nonrec(
            ann(),
            "f",
            let_expr(
                ann(),
                bind_nonrec(
                    ann_binding(U, 0),
                    "é😀",
                    abs(
                        ann_binding(U, 1),
                        "τ",
                        var(ann_variable(U, 1), None, "τ"),
                    ),
                ),
                var(ann_variable(U, 0), None, "é😀"),
            ),
        )],
    )
}

fn all_branches() -> Value {
    module(
        M,
        vec![import(ann())],
        vec![
            // NonRec let with a lambda and a matching use.
            bind_nonrec(
                ann(),
                "f",
                let_expr(
                    ann(),
                    bind_nonrec(
                        ann_binding(M, 0),
                        "g",
                        abs(ann_binding(M, 1), "x", var(ann_variable(M, 1), None, "x")),
                    ),
                    var(ann_variable(M, 0), None, "g"),
                ),
            ),
            // Literals, including both value shapes.
            bind_nonrec(ann(), "lit", literal_expr(ann(), literal_array(vec![var(ann(), None, "p")]))),
            bind_nonrec(
                ann(),
                "lit2",
                literal_expr(ann(), literal_record(vec![("k", var(ann(), None, "p"))])),
            ),
            bind_nonrec(ann(), "ctor", constructor_expr(ann())),
            bind_nonrec(ann(), "acc", accessor(ann(), var(ann(), None, "p"), "f")),
            bind_nonrec(
                ann(),
                "upd",
                update(ann(), var(ann(), None, "p"), vec![("f", var(ann(), None, "p"))]),
            ),
            bind_nonrec(ann(), "app", app(ann(), var(ann(), None, "p"), var(ann(), None, "p"))),
            // Case with every binder, an unconditional result and two guards.
            bind_nonrec(
                ann(),
                "case",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![
                        alternative(
                            vec![
                                binder_value(binder_null(ann())),
                                binder_value(binder_var(ann_binding(M, 2), "v")),
                                binder_value(binder_named(
                                    ann_binding(M, 3),
                                    "n",
                                    binder_var(ann_binding(M, 4), "i"),
                                )),
                                binder_value(binder_constructor(
                                    ann(),
                                    vec![binder_var(ann_binding(M, 5), "c")],
                                )),
                                binder_value(binder_literal(
                                    ann(),
                                    binder_literal_array(vec![binder_var(ann_binding(M, 6), "la")]),
                                )),
                                binder_value(binder_literal(
                                    ann(),
                                    binder_literal_record(vec![(
                                        "k",
                                        binder_var(ann_binding(M, 7), "lr"),
                                    )]),
                                )),
                            ],
                            unconditional(var(ann_variable(M, 7), None, "lr")),
                        ),
                        alternative(
                            vec![binder_value(binder_var(ann_binding(M, 8), "w"))],
                            guarded(vec![guard(
                                var(ann_variable(M, 8), None, "w"),
                                var(ann_variable(M, 8), None, "w"),
                            )]),
                        ),
                    ],
                ),
            ),
            // A recursive let group: every binding registers before any body.
            bind_nonrec(
                ann(),
                "letrec",
                let_expr(
                    ann(),
                    bind_rec(vec![
                        (
                            ann_binding(M, 9),
                            "r1",
                            abs(
                                ann_binding(M, 10),
                                "q",
                                var(ann_variable(M, 10), None, "q"),
                            ),
                        ),
                        (ann_binding(M, 11), "r2", var(ann_variable(M, 9), None, "r1")),
                    ]),
                    var(ann_variable(M, 9), None, "r1"),
                ),
            ),
            bind_nonrec(ann(), "ta", type_app(ann(), var(ann(), None, "p"))),
            // A top-level Rec group: names are never registered.
            bind_rec(vec![
                (ann(), "t1", var(ann(), None, "p")),
                (ann(), "t2", var(ann(), None, "p")),
            ]),
            // The explicit empty usage record behaves like a missing one.
            bind_nonrec(ann_empty_just(), "empty-just", var(ann(), None, "p")),
            // Variables without facts never consult the scope, even qualified.
            bind_nonrec(ann(), "free", var(ann(), Some(M), "not-in-scope")),
        ],
    )
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    assert_eq!(args.len(), 2, "Usage: purust_native_source_usage_test MODULES");
    let modules_text = std::fs::read_to_string(&args[1]).unwrap();

    // 1. Every constructor and guard reaches the native path successfully.
    assert_accepts("all branches", &all_branches());
    assert_accepts("unicode identifiers", &unicode_accepts());
    assert_rejects(
        "unicode identifier mismatch",
        &module(
            U,
            vec![],
            vec![bind_nonrec(
                ann(),
                "f",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(U, 0), "é😀", var(ann(), None, "p")),
                    var(ann_variable(U, 0), None, "ε"),
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );

    // 2. Every message, and the annotation position that first triggers it.
    assert_rejects(
        "import facts",
        &module(M, vec![import(ann_binding(M, 0))], vec![]),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "import variable facts",
        &module(M, vec![import(ann_variable(M, 0))], vec![]),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "top binding facts",
        &module(M, vec![], vec![bind_nonrec(ann_binding(M, 0), "x", var(ann(), None, "p"))]),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "literal facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                literal_expr(
                    ann_binding(M, 0),
                    literal_array(vec![var(ann_binding(M, 1), None, "p")]),
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "constructor facts",
        &module(M, vec![], vec![bind_nonrec(ann(), "x", constructor_expr(ann_binding(M, 0)))]),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "accessor facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                accessor(ann_binding(M, 0), var(ann(), None, "p"), "f"),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "update facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                update(
                    ann_binding(M, 0),
                    var(ann(), None, "p"),
                    vec![("f", var(ann_binding(M, 1), None, "p"))],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "app facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                app(ann_binding(M, 0), var(ann(), None, "p"), var(ann(), None, "p")),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "case facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann_binding(M, 0),
                    vec![var(ann_binding(M, 1), None, "p")],
                    vec![alternative(vec![], unconditional(var(ann(), None, "p")))],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "let facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann_binding(M, 0),
                    bind_nonrec(ann_binding(M, 1), "y", var(ann(), None, "p")),
                    var(ann(), None, "y"),
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "typeapp facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(ann(), "x", type_app(ann_binding(M, 0), var(ann(), None, "p")))],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "null binder facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_null(ann_binding(M, 0)))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "constructor binder facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_constructor(
                            ann_binding(M, 0),
                            vec![binder_var(ann_binding(M, 1), "v")],
                        ))],
                        unconditional(var(ann_binding(M, 2), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "literal binder facts",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_literal(
                            ann_binding(M, 0),
                            binder_literal_array(vec![binder_var(ann_binding(M, 1), "v")]),
                        ))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "variableUse on lambda annotation",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                abs(ann_variable(M, 0), "y", var(ann(), None, "p")),
            )],
        ),
        "variableUse on a binding annotation",
    );
    assert_rejects(
        "variableUse on let annotation",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_variable(M, 0), "y", var(ann(), None, "p")),
                    var(ann(), None, "y"),
                ),
            )],
        ),
        "variableUse on a binding annotation",
    );
    assert_rejects(
        "variableUse on binder annotation",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_var(ann_variable(M, 0), "v"))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "variableUse on a binding annotation",
    );
    assert_rejects(
        "variableUse on named binder annotation",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_named(
                            ann_variable(M, 0),
                            "n",
                            binder_null(ann_binding(M, 1)),
                        ))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "variableUse on a binding annotation",
    );
    assert_rejects(
        "source binding from another module",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding("Other.Module", 0), "y", var(ann(), None, "p")),
                    var(ann(), None, "y"),
                ),
            )],
        ),
        "source binding from another module",
    );
    assert_rejects(
        "duplicate source bindingId",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "y", var(ann(), None, "p")),
                    let_expr(
                        ann(),
                        bind_nonrec(ann_binding(M, 0), "z", var(ann(), None, "p")),
                        var(ann(), None, "z"),
                    ),
                ),
            )],
        ),
        "duplicate source bindingId",
    );
    assert_rejects(
        "duplicate across declarations",
        &module(
            M,
            vec![],
            vec![
                bind_nonrec(ann(), "x", let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "y", var(ann(), None, "p")),
                    var(ann(), None, "y"),
                )),
                bind_nonrec(ann(), "z", let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "w", var(ann(), None, "p")),
                    var(ann(), None, "w"),
                )),
            ],
        ),
        "duplicate source bindingId",
    );
    assert_rejects(
        "duplicate inside a Rec group",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_rec(vec![
                        (ann_binding(M, 0), "a", var(ann(), None, "p")),
                        (ann_binding(M, 0), "b", var(ann(), None, "p")),
                    ]),
                    var(ann(), None, "a"),
                ),
            )],
        ),
        "duplicate source bindingId",
    );
    assert_rejects(
        "bindingUsage on a variable occurrence",
        &module(
            M,
            vec![],
            vec![bind_nonrec(ann(), "x", var(ann_binding(M, 0), None, "p"))],
        ),
        "bindingUsage on a variable occurrence",
    );
    assert_rejects(
        "variableUse outside its lexical binding",
        &module(
            M,
            vec![],
            vec![bind_nonrec(ann(), "x", var(ann_variable(M, 0), None, "p"))],
        ),
        "variableUse outside its lexical binding",
    );
    // Qualified names are never local, even for the current module.
    assert_rejects(
        "qualified variableUse is never local",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                abs(
                    ann_binding(M, 0),
                    "p",
                    var(ann_variable(M, 0), Some(M), "p"),
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );
    // An unannotated local hides an outer annotated variable of the same name.
    assert_rejects(
        "unannotated shadow",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                abs(
                    ann_binding(M, 0),
                    "p",
                    abs(ann(), "p", var(ann_variable(M, 0), None, "p")),
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );
    // Binders can never leak across case alternatives.
    assert_rejects(
        "no leakage across alternatives",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![
                        alternative(
                            vec![binder_value(binder_var(ann_binding(M, 0), "w"))],
                            unconditional(var(ann(), None, "w")),
                        ),
                        alternative(vec![], unconditional(var(ann_variable(M, 0), None, "w"))),
                    ],
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );
    // NonRec expressions cannot refer to their own binding.
    assert_rejects(
        "NonRec self reference",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "y", var(ann_variable(M, 0), None, "y")),
                    var(ann(), None, "y"),
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );
    // Top-level Rec names are not registered either.
    assert_rejects(
        "top-level Rec does not register",
        &module(
            M,
            vec![],
            vec![bind_rec(vec![
                (ann(), "t1", var(ann(), None, "p")),
                (ann(), "t2", var(ann_variable(M, 0), None, "t1")),
            ])],
        ),
        "variableUse outside its lexical binding",
    );

    // 3. First-error order.
    assert_rejects(
        "NonRec expression before register",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "y", var(ann(), None, "p")),
                    let_expr(
                        ann(),
                        bind_nonrec(
                            ann_binding(M, 0),
                            "z",
                            var(ann_binding(M, 1), None, "p"),
                        ),
                        var(ann(), None, "z"),
                    ),
                ),
            )],
        ),
        "bindingUsage on a variable occurrence",
    );
    assert_rejects(
        "Rec register before expressions",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "seed", var(ann(), None, "p")),
                    let_expr(
                        ann(),
                        bind_rec(vec![
                            (ann_binding(M, 0), "a", var(ann(), None, "p")),
                            (ann_binding(M, 1), "b", var(ann_binding(M, 2), None, "p")),
                        ]),
                        var(ann(), None, "a"),
                    ),
                ),
            )],
        ),
        "duplicate source bindingId",
    );
    assert_rejects(
        "register variableUse before module",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                abs(
                    ann_full(Some(("Other.Module", 0)), Some((M, 0))),
                    "y",
                    var(ann(), None, "p"),
                ),
            )],
        ),
        "variableUse on a binding annotation",
    );
    assert_rejects(
        "register module before duplicate",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "seed", var(ann(), None, "p")),
                    let_expr(
                        ann(),
                        bind_nonrec(ann_binding("Other.Module", 0), "y", var(ann(), None, "p")),
                        var(ann(), None, "y"),
                    ),
                ),
            )],
        ),
        "source binding from another module",
    );
    assert_rejects(
        "imports before declarations",
        &module(
            M,
            vec![import(ann_binding(M, 0))],
            vec![bind_nonrec(ann(), "x", var(ann_binding(M, 1), None, "p"))],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "declaration order",
        &module(
            M,
            vec![],
            vec![
                bind_nonrec(ann(), "x", var(ann_binding(M, 0), None, "p")),
                bind_nonrec(ann(), "y", var(ann_variable(M, 0), None, "p")),
            ],
        ),
        "bindingUsage on a variable occurrence",
    );
    assert_rejects(
        "literal annotation before values",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                literal_expr(
                    ann_binding(M, 0),
                    literal_array(vec![var(ann_binding(M, 1), None, "p")]),
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "binder annotation before patterns",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_constructor(
                            ann_binding(M, 0),
                            vec![binder_var(ann_binding(M, 1), "v")],
                        ))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "named binder registers before inner",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_named(
                            ann_binding(M, 0),
                            "n",
                            binder_null(ann_binding(M, 1)),
                        ))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "case values before alternatives",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann_binding(M, 0), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_null(ann_binding(M, 1)))],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "bindingUsage on a variable occurrence",
    );
    assert_rejects(
        "patterns before result",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_null(ann_binding(M, 0)))],
                        unconditional(var(ann_binding(M, 1), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "patterns left to right",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![
                            binder_value(binder_null(ann_binding(M, 0))),
                            binder_value(binder_var(ann_variable(M, 1), "v")),
                        ],
                        unconditional(var(ann(), None, "p")),
                    )],
                ),
            )],
        ),
        "source usage facts on a nonlocal annotation",
    );
    assert_rejects(
        "guard condition before expression",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_var(ann(), "w"))],
                        guarded(vec![guard(
                            var(ann_binding(M, 0), None, "w"),
                            var(ann_binding(M, 1), None, "w"),
                        )]),
                    )],
                ),
            )],
        ),
        "bindingUsage on a variable occurrence",
    );
    assert_rejects(
        "guard order",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                case_expr(
                    ann(),
                    vec![var(ann(), None, "p")],
                    vec![alternative(
                        vec![binder_value(binder_var(ann(), "w"))],
                        guarded(vec![
                            guard(var(ann_variable(M, 0), None, "w"), var(ann(), None, "w")),
                            guard(var(ann_binding(M, 1), None, "w"), var(ann(), None, "w")),
                        ]),
                    )],
                ),
            )],
        ),
        "variableUse outside its lexical binding",
    );
    assert_rejects(
        "let bindings before body",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                ann(),
                "x",
                let_expr(
                    ann(),
                    bind_nonrec(ann_binding(M, 0), "y", var(ann(), None, "p")),
                    var(ann_binding(M, 1), None, "y"),
                ),
            )],
        ),
        "bindingUsage on a variable occurrence",
    );
    // A usage error found before a malformed node is still the exact first
    // error and must not fall back.
    assert_rejects(
        "usage error before unsupported shape",
        &module(
            M,
            vec![],
            vec![
                bind_nonrec(ann(), "x", var(ann_binding(M, 0), None, "p")),
                Value::Unit,
            ],
        ),
        "bindingUsage on a variable occurrence",
    );

    // 4. Unsupported but PureScript-valid shapes fall back exactly once.
    assert_fallback(
        "generic record module",
        &record_a(vec![
            ("name", string(M)),
            ("imports", mk_array(vec![])),
            ("decls", mk_array(vec![])),
        ]),
    );
    assert_fallback(
        "generic record annotation",
        &module(
            M,
            vec![],
            vec![bind_nonrec(
                record_a(vec![("sourceUsage", maybe(None))]),
                "x",
                var(ann(), None, "p"),
            )],
        ),
    );

    // 5. Frozen corpus: whole modules decoded natively, then validated by both
    //    implementations. The corpus is the same frozen TAST output used by the
    //    module decoder differential test. These frozen modules are all valid:
    //    a decoder or validator regression must fail, never filter a module.
    let mut modules = 0usize;
    let mut validated = 0usize;
    for (number, line) in modules_text.lines().enumerate() {
        if line.is_empty() {
            continue;
        }
        let input = parse(line);
        let module = match decode_without_validation(&input) {
            Ok(module) => module,
            Err(error) => panic!("frozen module {number}: decode failed: {}", print_decode_error(&error)),
        };
        let run = run(&module);
        let context = format!("frozen module {number}");
        assert_eq!(run.fallbacks, 0, "{context}: validator fell back");
        assert_same_outcome(&context, run.native.as_ref(), run.ps.as_ref());
        assert_same_outcome(&context, run.wrapper.as_ref(), run.ps.as_ref());
        if matches!(run.ps.as_ref(), Either::Left(_)) {
            validated += 1;
        }
        modules += 1;
    }
    assert!(modules > 0, "no frozen modules");
    assert_eq!(modules, modules_text.lines().filter(|line| !line.is_empty()).count());
    assert_eq!(validated, 0, "a previously valid frozen module failed validation");

    println!(
        "Native source usage: all {modules} frozen modules accepted, plus all synthetic branches, messages and first-error orders passed"
    );
}

fn parse(text: &str) -> Value {
    Purs_Data_Argonaut_Core::purust_json_parse_text(&purust_string_from_utf8(text))
        .expect("valid JSON")
}

// The native module path accepts a no-op validator. The older PureScript module
// decoder still validates; that is fine for this entirely valid frozen corpus,
// and any failure remains fatal. Invalid AST fixtures are constructed directly.
fn decode_without_validation(input: &Value) -> Result<Value, Rc<JsonDecodeError>> {
    let fallback = Func1::Shared(Rc::new(|input: Value| -> Value {
        Value::Class(Rc::new(PureScript_Backend_Optimizer_CoreFn_Json_decodeModulePS(input)))
    }));
    let validate = Func1::Shared(Rc::new(|_module: Value| -> Rc<Either> {
        Rc::new(Either::Right(mk_unit(())))
    }));
    let decoded = PureScript_Backend_Optimizer_CoreFn_Json_decodeModuleImpl(
        fallback,
        validate,
        input.clone(),
    );
    match decoded.unwrap_class::<Rc<Either>>().as_ref() {
        Either::Left(error) => Err(error.unwrap_class::<Rc<JsonDecodeError>>().clone()),
        Either::Right(module) => Ok(module.clone()),
    }
}

fn print_decode_error(error: &Rc<JsonDecodeError>) -> String {
    Data_Argonaut_Decode_Error_printJsonDecodeError(error.clone())
}
