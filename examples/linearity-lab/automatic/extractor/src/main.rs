use serde_json::{json, Value};
use syn::{FnArg, Item, ReturnType, Type};

fn describe(ty: &Type, output: bool) -> Value {
    match ty {
        Type::Tuple(t) if t.elems.is_empty() => json!({"kind":"unit"}),
        Type::Path(p) if p.qself.is_none() && p.path.segments.len() == 1 => {
            let segment = &p.path.segments[0];
            assert!(segment.arguments.is_empty(), "generic types are outside this experiment");
            match segment.ident.to_string().as_str() {
                "i64" => json!({"kind":"int"}),
                "Session" => json!({"kind":"resource", "mode":if output {"owned-result"} else {"consume"}}),
                _ => panic!("unsupported type"),
            }
        }
        Type::Reference(r) if !output && r.lifetime.is_none() => {
            assert!(matches!(r.elem.as_ref(), Type::Path(p) if p.qself.is_none() && p.path.is_ident("Session")),
                "unsupported signature: only immediate Session borrows are covered");
            json!({"kind":"resource","mode":if r.mutability.is_some() {"borrow-mut"} else {"borrow"}})
        }
        _ => panic!("unsupported signature: refuse rather than erase ownership information"),
    }
}

fn main() {
    let path = std::env::args().nth(1).expect("Rust input file");
    let source = std::fs::read_to_string(path).unwrap();
    let file = syn::parse_file(&source).expect("valid Rust syntax");
    let mut functions = Vec::new();
    for item in file.items {
        if let Item::Fn(function) = item {
            if !matches!(function.vis, syn::Visibility::Public(_)) { continue; }
            let sig = function.sig;
            assert!(sig.generics.params.is_empty() && sig.generics.where_clause.is_none()
                && sig.asyncness.is_none() && sig.unsafety.is_none() && sig.abi.is_none()
                && sig.variadic.is_none(), "unsupported function contract");
            let args: Vec<_> = sig.inputs.iter().map(|arg| match arg {
                FnArg::Typed(arg) => describe(&arg.ty, false),
                _ => panic!("methods are not covered"),
            }).collect();
            let result = match &sig.output {
                ReturnType::Default => json!({"kind":"unit"}),
                ReturnType::Type(_, ty) => describe(ty, true),
            };
            functions.push(json!({"name":sig.ident.to_string(),"args":args,"result":result}));
        }
    }
    assert!(!functions.is_empty(), "no supported functions");
    println!("{}", json!({"resource":"Session","functions":functions}));
}
