#![allow(warnings)]
use purust_core::*;
use std::sync::Arc;
use Purs_Data_Either::Either;
use Purs_Data_Maybe::Maybe;
use Purs_Data_Tuple::Tuple;
use Purs_PureScript_Backend_Optimizer_CoreFn::Qualified;
use Purs_PureScript_Backend_Optimizer_Semantics::{EvalRef, InlineAccessor, InlineDirective};
use Purs_PureScript_Backend_Optimizer_Directives as parser;

fn result_key(result: &Either) -> String {
    let Either::Right(value) = result else { panic!("expected a valid directive"); };
    let maybe = value.unwrap_class_shared::<Maybe>();
    let Maybe::Just(pair) = maybe.as_ref() else { return "empty".into(); };
    let pair = pair.unwrap_class_shared::<Tuple>();
    let Tuple::Tuple(key, content) = pair.as_ref();
    let key = key.unwrap_class_shared::<EvalRef>();
    let EvalRef::EvalExtern(qualified) = key.as_ref() else { panic!("local directive"); };
    let Qualified::Qualified(module, ident) = qualified.as_ref();
    let Maybe::Just(module) = module.as_ref() else { panic!("unqualified directive"); };
    let content = content.unwrap_class_shared::<Tuple>();
    let Tuple::Tuple(accessor, directive) = content.as_ref();
    let accessor = match accessor.unwrap_class_shared::<InlineAccessor>().as_ref() {
        InlineAccessor::InlineRef => "ref".into(),
        InlineAccessor::InlineProp(name) => format!("prop:{name}"),
        InlineAccessor::InlineSpineProp(name) => format!("spine:{name}"),
    };
    let directive = match directive.unwrap_class_shared::<InlineDirective>().as_ref() {
        InlineDirective::InlineDefault => "default".into(),
        InlineDirective::InlineNever => "never".into(),
        InlineDirective::InlineAlways => "always".into(),
        InlineDirective::InlineArity(arity) => format!("arity:{arity}"),
    };
    format!("{}|{}|{}|{}", module.unwrap_string(), ident.unwrap_string(), accessor, directive)
}

fn check(line: &str) {
    let input = purust_string_from_utf8(line);
    let reference = parser::PureScript_Backend_Optimizer_Directives_parseDirectiveLinePS(input.clone());
    let native = parser::PureScript_Backend_Optimizer_Directives_parseDirectiveLineImpl(
        Func1::Static(|line: String| -> Arc<Either> { panic!("unexpected fallback for {line:?}") }), input.clone());
    let wrapped = parser::PureScript_Backend_Optimizer_Directives_parseDirectiveLine(input);
    assert_eq!(result_key(&native), result_key(&reference), "native: {line:?}");
    assert_eq!(result_key(&wrapped), result_key(&reference), "wrapper: {line:?}");
}

fn check_fallback(line: &str) {
    let input = purust_string_from_utf8(line);
    let expected = input.clone();
    let marker = Arc::new(Either::Left(Value::String("authoritative-result".into())));
    let copy = marker.clone();
    let actual = parser::PureScript_Backend_Optimizer_Directives_parseDirectiveLineImpl(
        Func1::Shared(Arc::new(move |line: String| -> Arc<Either> {
            assert_eq!(line, expected, "fallback must receive the original line, including whitespace and errors");
            copy.clone()
        })), input);
    assert!(Arc::ptr_eq(&actual, &marker), "fallback result was changed: {line:?}");
}

fn main() {
    let defaults = Purs_PureScript_Backend_Optimizer_Directives_Defaults::PureScript_Backend_Optimizer_Directives_Defaults_defaultDirectives();
    let mut lines = 0;
    for line in defaults.split('\n') { check(line); lines += 1; }
    let mut synthetic = 0;
    for reference in ["A.a", "Control.Applicative.applicativeFn.pure", "A0.B_c'.foo'._bar1", "X._", "X.forall", "A.x.case", "A.x.forall'", "A.a'"] {
        for directive in ["always", "never", "default", "arity=1", "arity = 12", "arity=2147483647", "arity  =  42"] {
            for (prefix, suffix) in [("", ""), ("   ", "   "), (" ", " -- ignored"), ("", "--comment")] {
                check(&format!("{prefix}{reference} {directive}{suffix}")); synthetic += 1;
            }
        }
    }
    for seed in 0..128 {
        check(&format!("M{}.N_{}.f{}'.label{} arity={}", seed % 17, seed % 11, seed, seed % 7, seed + 1));
        synthetic += 1;
    }
    let fallbacks = ["M.x arity=0", "M.x arity=-1", "M.x arity=+1", "M.x arity=01", "M.x arity=1_000",
        "M.x arity=2147483648", "M.x arity=99999999999999999999999999999999999", "M.x arity=1.5", "M.x arity=0x10",
        "M.x arity=", "M.x always junk", "M.x", "m.x always", "M.X always", "M..x always", "x always", "M.x.y.z always",
        "M.x._ always", "M.x.forall always", "M.x.\"label\" always", "M.x.(..).field always", "M.x . field always",
        "M.x\t always", "\t", "M.x always\r", "M.x always\nM.y never", "-- comment\nM.x always", "{- block -}",
        "M.λ always", "État.é always", "M.x.\"😀\" always", "M.x always\u{00a0}", "M.x always\0"];
    for line in &fallbacks { check_fallback(line); }
    println!("Native directives: {lines} default lines / {synthetic} generated valid cases / {} exact fallback probes passed", fallbacks.len());
}
