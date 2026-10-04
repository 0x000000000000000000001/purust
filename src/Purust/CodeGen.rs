pub(crate) fn purust_codegen_sanitize_ident(mut input: String) -> String {
    // Reuse the owned buffer for the overwhelmingly common ASCII case.
    let first_escape = input.bytes().position(|b| !b.is_ascii_alphanumeric() && b != b'_');
    let Some(first_escape) = first_escape else {
        if matches!(input.as_str(), "type" | "fn" | "break" | "mod" | "as" | "gen"
            | "use" | "pub" | "ref" | "mut" | "move" | "let" | "if" | "loop") {
            input.push_str("_kw");
        }
        return input;
    };
    let mut output = String::with_capacity(input.len());
    output.push_str(&input[..first_escape]);
    for ch in input[first_escape..].chars() {
        match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '_' => output.push(ch),
            '\'' => output.push_str("_prime"),
            '$' => output.push_str("_dollar_"),
            '-' => output.push_str("_minus_"),
            '.' => output.push_str("_dot_"),
            '"' => output.push_str("_quote_"),
            _ => {
                // Runtime strings contain one encoded scalar per UTF-16 unit,
                // including isolated surrogates, just like CodeUnits.toCharArray.
                use std::fmt::Write;
                write!(&mut output, "_u{}_", purust_char_to_code_unit(ch)).unwrap();
            }
        }
    }
    output
}

pub fn Purust_CodeGen_sanitizeIdentImpl(_fallback: Func1<String, String>, input: String) -> String {
    purust_codegen_sanitize_ident(input)
}

// Render `ExprType` into its Rust representation without allocating through the
// generic runtime. The layout-fact map and the type tree stay borrowed; native
// buffers hold rendered fragments and function arguments. Every constructor the PureScript reference
// can classify is handled here. A shape that cannot be interpreted delegates
// the whole call to the supplied fallback, which is
// `codegenExprTypeWithValueEnumsPure`.

const purust_codegen_type_marker: &str = "$opaque$";
const purust_codegen_type_max_arity: usize = 12;

enum PurustCodegenRenderArg<'a> {
    Adt { fqn: &'a Value },
    Ty(&'a Purs_PureScript_Backend_Optimizer_CoreFn::ExprType),
}

enum PurustCodegenRenderType<'a> {
    Plain(&'a Purs_PureScript_Backend_Optimizer_CoreFn::ExprType),
    Any,
    Func {
        args: Vec<PurustCodegenRenderArg<'a>>,
        ret: Box<PurustCodegenRenderType<'a>>,
    },
}

fn purust_codegen_string_array(value: &Value) -> Option<&std::rc::Rc<Vec<Value>>> {
    match value.resolve() {
        Value::Array(items) => Some(items),
        _ => None,
    }
}

// Map keys are boxed shared ADTs. `ClassShared` erases the owner unsized, so
// the borrow reaches it through one downcast; legacy `Class` boxes still nest
// the Rc and are dereferenced one level further.
fn purust_codegen_tuple(value: &Value) -> Option<&Purs_Data_Tuple::Tuple> {
    match value.resolve() {
        Value::Class(payload) => payload
            .downcast_ref::<std::rc::Rc<Purs_Data_Tuple::Tuple>>()
            .map(|tuple| &**tuple),
        Value::ClassShared(payload) => payload.downcast_ref::<Purs_Data_Tuple::Tuple>(),
        _ => None,
    }
}

fn purust_codegen_boxed_type(
    value: &Value,
) -> Option<&Purs_PureScript_Backend_Optimizer_CoreFn::ExprType> {
    match value.resolve() {
        Value::Class(payload) => payload
            .downcast_ref::<std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>>()
            .map(|ty| &**ty),
        Value::ClassShared(payload) => {
            payload.downcast_ref::<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>()
        }
        _ => None,
    }
}

// Compare the virtual key `"$opaque$" <> type_name` with the stored node name
// without materializing the marker key.
fn purust_codegen_cmp_marker(type_name: &str, node_name: &str) -> std::cmp::Ordering {
    let mut query = purust_codegen_type_marker.bytes().chain(type_name.bytes());
    let mut node = node_name.bytes();
    loop {
        match (query.next(), node.next()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(query_byte), Some(node_byte)) if query_byte != node_byte => {
                return query_byte.cmp(&node_byte)
            }
            _ => {}
        }
    }
}

fn purust_codegen_layout_contains_with(
    enums: &Purs_Data_Map_Internal::Map,
    module: &str,
    compare_name: impl Fn(&str) -> std::cmp::Ordering,
) -> bool {
    use Purs_Data_Map_Internal::Map;
    let mut node = enums;
    while let Map::Node(_, _, key, _, left, right) = node {
        let tuple = match purust_codegen_tuple(key) {
            Some(tuple) => tuple,
            None => return false,
        };
        let Purs_Data_Tuple::Tuple::Tuple(module_key, name_key) = tuple;
        let (Value::String(module_value), Value::String(name_value)) =
            (module_key.resolve(), name_key.resolve())
        else {
            return false;
        };
        node = match module.cmp(module_value).then_with(|| compare_name(name_value)) {
            std::cmp::Ordering::Less => left,
            std::cmp::Ordering::Greater => right,
            std::cmp::Ordering::Equal => return true,
        };
    }
    false
}

fn purust_codegen_layout_contains(
    enums: &Purs_Data_Map_Internal::Map,
    module: &str,
    name: &str,
) -> bool {
    purust_codegen_layout_contains_with(enums, module, |node_name| name.cmp(node_name))
}

fn purust_codegen_layout_contains_opaque(
    enums: &Purs_Data_Map_Internal::Map,
    module: &str,
    name: &str,
) -> bool {
    purust_codegen_layout_contains_with(enums, module, |node_name| {
        purust_codegen_cmp_marker(name, node_name)
    })
}

fn purust_codegen_render_adt(
    enums: &Purs_Data_Map_Internal::Map,
    current_mod: &str,
    class_name: &str,
    fqn: &Value,
) -> Option<String> {
    let items = purust_codegen_string_array(fqn)?;
    let len = items.len();
    // String.joinWith "_" (Array.dropEnd 1 fqn) then replaceAll "." "_".
    let mut mod_name = String::new();
    for (index, item) in items.iter().take(len.saturating_sub(1)).enumerate() {
        if index > 0 {
            mod_name.push('_');
        }
        let Value::String(part) = item.resolve() else { return None };
        if part.contains('.') {
            for ch in part.chars() {
                mod_name.push(if ch == '.' { '_' } else { ch });
            }
        } else {
            mod_name.push_str(part);
        }
    }
    let actual_class = match len.checked_sub(1) {
        Some(index) => match items[index].resolve() {
            Value::String(value) => value.as_str(),
            _ => return None,
        },
        None => class_name,
    };
    if actual_class == "Void" || (mod_name == "Pipes_Internal" && actual_class == "X") {
        return Some("purust_core::Void".to_string());
    }
    if mod_name == "Prim" || mod_name.starts_with("Prim_") || mod_name.starts_with("Prim") {
        return Some("crate::UnknownType".to_string());
    }
    if matches!(
        mod_name.as_str(),
        "Effect"
            | "Effect_Exception"
            | "Effect_Console"
            | "Effect_Ref"
            | "Effect_Uncurried"
            | "Control_Monad_ST_Internal"
            | "Data_Array_ST"
    ) {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Foreign" && actual_class == "Foreign" {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Promise_Rejection" && actual_class == "Rejection" {
        return Some("crate::UnknownType".to_string());
    }
    if matches!(mod_name.as_str(), "Effect_Aff" | "Effect_Aff_AVar" | "Effect_Aff_Compat") {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Data_Exists" && actual_class == "Exists" {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Data_Variant_Internal" && matches!(actual_class, "VariantCase" | "VariantFCase") {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Data_Variant" && actual_class == "Variant" {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Data_Functor_Variant" && actual_class == "VariantF" {
        return Some("crate::UnknownType".to_string());
    }
    if mod_name == "Control_Monad_Free" && actual_class == "Val" {
        return Some("crate::UnknownType".to_string());
    }
    if (mod_name == "Data_Function_Uncurried" || mod_name == "Control_Monad_ST_Uncurried")
        && (actual_class.starts_with("Fn") || actual_class.starts_with("STFn"))
    {
        return Some("crate::UnknownType".to_string());
    }
    if purust_codegen_layout_contains_opaque(enums, &mod_name, actual_class) {
        return Some("crate::UnknownType".to_string());
    }
    let sanitized = purust_codegen_sanitize_ident(actual_class.to_string());
    if purust_codegen_layout_contains(enums, &mod_name, actual_class) {
        let mut output = String::with_capacity(mod_name.len() + sanitized.len() + 10);
        if mod_name == current_mod {
            output.push_str("crate::");
        } else {
            output.push_str("Purs_");
            output.push_str(&mod_name);
            output.push_str("::");
        }
        output.push_str(&sanitized);
        return Some(output);
    }
    let mut output = String::with_capacity(mod_name.len() + sanitized.len() + 32);
    if mod_name == current_mod {
        output.push_str("std::rc::Rc<crate::");
    } else {
        output.push_str("std::rc::Rc<Purs_");
        output.push_str(&mod_name);
        output.push_str("::");
    }
    output.push_str(&sanitized);
    output.push('>');
    Some(output)
}

fn purust_codegen_render_plain(
    enums: &Purs_Data_Map_Internal::Map,
    current_mod: &str,
    ty: &Purs_PureScript_Backend_Optimizer_CoreFn::ExprType,
) -> Option<String> {
    use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType;
    Some(match ty {
        ExprType::Unit => "()".to_string(),
        ExprType::Int => "i64".to_string(),
        ExprType::Boolean => "bool".to_string(),
        ExprType::Number => "f64".to_string(),
        ExprType::String => "String".to_string(),
        ExprType::Char => "char".to_string(),
        ExprType::ADT(class_name, fqn, _) => {
            return purust_codegen_render_adt(enums, current_mod, class_name, fqn)
        }
        _ => "crate::UnknownType".to_string(),
    })
}

fn purust_codegen_unwrap<'a>(
    ty: &'a Purs_PureScript_Backend_Optimizer_CoreFn::ExprType,
) -> Option<PurustCodegenRenderType<'a>> {
    use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType;
    Some(match ty {
        ExprType::ForAll(_, body) => return purust_codegen_unwrap(body.as_ref()),
        ExprType::TypeApp(inner, _) => return purust_codegen_unwrap(inner.as_ref()),
        ExprType::TypeVar(_) => PurustCodegenRenderType::Any,
        ExprType::ConstrainedType(constraints, body) => {
            let items = purust_codegen_string_array(constraints)?;
            let mut heads: Vec<PurustCodegenRenderArg<'a>> = Vec::with_capacity(items.len());
            for item in items.iter() {
                let tuple = purust_codegen_tuple(item)?;
                let Purs_Data_Tuple::Tuple::Tuple(fqn, _) = tuple;
                heads.push(PurustCodegenRenderArg::Adt { fqn });
            }
            match purust_codegen_unwrap(body.as_ref())? {
                PurustCodegenRenderType::Func { args, ret } => {
                    let mut all = heads;
                    all.extend(args);
                    PurustCodegenRenderType::Func { args: all, ret }
                }
                other => PurustCodegenRenderType::Func {
                    args: heads,
                    ret: Box::new(other),
                },
            }
        }
        ExprType::Func(args, ret) => {
            let items = purust_codegen_string_array(args)?;
            let mut rendered: Vec<PurustCodegenRenderArg<'a>> = Vec::with_capacity(items.len());
            for item in items.iter() {
                rendered.push(PurustCodegenRenderArg::Ty(purust_codegen_boxed_type(item)?));
            }
            PurustCodegenRenderType::Func {
                args: rendered,
                ret: Box::new(purust_codegen_unwrap(ret.as_ref())?),
            }
        }
        other => PurustCodegenRenderType::Plain(other),
    })
}

fn purust_codegen_render_unwrapped(
    enums: &Purs_Data_Map_Internal::Map,
    current_mod: &str,
    _is_ret: bool,
    ty: &PurustCodegenRenderType,
) -> Option<String> {
    match ty {
        PurustCodegenRenderType::Plain(inner) => {
            purust_codegen_render_plain(enums, current_mod, *inner)
        }
        PurustCodegenRenderType::Any => Some("crate::UnknownType".to_string()),
        PurustCodegenRenderType::Func { args, ret } => {
            let arity = args.len();
            let mut parts: Vec<String> = Vec::with_capacity(arity + 1);
            for arg in args.iter() {
                let text = match arg {
                    PurustCodegenRenderArg::Adt { fqn } => {
                        purust_codegen_render_adt(enums, current_mod, "", *fqn)?
                    }
                    PurustCodegenRenderArg::Ty(inner) => {
                        purust_codegen_render_ty(enums, current_mod, false, inner)?
                    }
                };
                parts.push(text);
            }
            parts.push(purust_codegen_render_unwrapped(enums, current_mod, true, ret.as_ref())?);
            if arity > 0 && arity <= purust_codegen_type_max_arity {
                let capacity = parts.iter().map(String::len).sum::<usize>() + 24;
                let mut output = String::with_capacity(capacity);
                output.push_str("purust_core::Func");
                output.push_str(&arity.to_string());
                output.push('<');
                output.push_str(&parts.join(", "));
                output.push('>');
                Some(output)
            } else {
                Some("crate::UnknownType".to_string())
            }
        }
    }
}

fn purust_codegen_render_ty(
    enums: &Purs_Data_Map_Internal::Map,
    current_mod: &str,
    is_ret: bool,
    ty: &Purs_PureScript_Backend_Optimizer_CoreFn::ExprType,
) -> Option<String> {
    let unwrapped = purust_codegen_unwrap(ty)?;
    purust_codegen_render_unwrapped(enums, current_mod, is_ret, &unwrapped)
}

fn purust_codegen_render(
    enums: &Purs_Data_Map_Internal::Map,
    current_mod: &str,
    is_ret: bool,
    ty: &std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>,
) -> Option<String> {
    purust_codegen_render_ty(enums, current_mod, is_ret, ty.as_ref())
}

pub fn Purust_CodeGen_codegenExprTypeWithValueEnumsImpl(
    fallback: Func4<
        std::rc::Rc<Purs_Data_Map_Internal::Map>,
        String,
        bool,
        std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>,
        String,
    >,
    enums: std::rc::Rc<Purs_Data_Map_Internal::Map>,
    current_mod: String,
    is_ret: bool,
    ty: std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>,
) -> String {
    match purust_codegen_render(&enums, &current_mod, is_ret, &ty) {
        Some(rendered) => rendered,
        None => fallback(enums, current_mod, is_ret, ty),
    }
}

// Common coercions only need type spellings and a borrowed view of the source.
// Return the owned buffer unchanged whenever possible; the reference handles
// function adapters and class dictionaries, including all recursive coercions.
fn purust_codegen_simple_coercion(
    enums: &Purs_Data_Map_Internal::Map, current_mod: &str,
    expected: &Purs_PureScript_Backend_Optimizer_CoreFn::ExprType,
    actual: &Purs_PureScript_Backend_Optimizer_CoreFn::ExprType, code: &str,
) -> Option<(&'static str, &'static str)> {
    use Purs_PureScript_Backend_Optimizer_CoreFn::ExprType;
    let expected = purust_codegen_unwrap(expected)?;
    let actual = purust_codegen_unwrap(actual)?;
    let exp = purust_codegen_render_unwrapped(enums, current_mod, true, &expected)?;
    let act = purust_codegen_render_unwrapped(enums, current_mod, true, &actual)?;
    if exp == act || code.starts_with("unimplemented!()")
        || (code.starts_with("/* Typed ") && code.contains("unimplemented!()") && !code.contains('\n'))
        || code.ends_with("continue;\n    }") {
        return Some(("", ""));
    }
    if matches!(expected, PurustCodegenRenderType::Func { .. } | PurustCodegenRenderType::Plain(ExprType::ADT(..)))
        || matches!(actual, PurustCodegenRenderType::Func { .. } | PurustCodegenRenderType::Plain(ExprType::ADT(..))) {
        return None;
    }
    Some(match (exp.as_str(), act.as_str()) {
        ("()", "crate::UnknownType") => ("(", ").unwrap_unit()"),
        ("crate::UnknownType", "()") => ("crate::mk_unit(", ")"),
        ("i64", "crate::UnknownType" | "purust_core::Value") => ("(", ").unwrap_int()"),
        ("crate::UnknownType" | "purust_core::Value", "i64") => ("crate::mk_int(", ")"),
        ("bool", "crate::UnknownType" | "purust_core::Value") => ("(", ").unwrap_bool()"),
        ("crate::UnknownType" | "purust_core::Value", "bool") => ("crate::mk_bool(", ")"),
        ("f64", "crate::UnknownType" | "purust_core::Value") => ("(", ").unwrap_number()"),
        ("crate::UnknownType" | "purust_core::Value", "f64") => ("crate::mk_number(", ")"),
        ("f64", "i64") => ("(", " as f64)"),
        ("i64", "f64") => ("(", " as i64)"),
        ("char", "crate::UnknownType" | "purust_core::Value") => ("(", ").unwrap_char()"),
        ("crate::UnknownType" | "purust_core::Value", "char") => ("crate::mk_char(", ")"),
        ("String", "crate::UnknownType" | "purust_core::Value") => ("(", ").unwrap_string()"),
        ("crate::UnknownType" | "purust_core::Value", "String") => ("purust_core::Value::String(", ")"),
        _ => ("", ""),
    })
}

pub fn Purust_CodeGen_boxUnboxImpl(
    reference: Func7<
        std::rc::Rc<Purs_Data_Map_Internal::Map>, std::rc::Rc<Purs_Data_Map_Internal::Map>,
        std::rc::Rc<Purs_Data_Map_Internal::Map>, String,
        std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>,
        std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>, String, String>,
    renames: std::rc::Rc<Purs_Data_Map_Internal::Map>, enums: std::rc::Rc<Purs_Data_Map_Internal::Map>,
    fields: std::rc::Rc<Purs_Data_Map_Internal::Map>, current_mod: String,
    expected: std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>,
    actual: std::rc::Rc<Purs_PureScript_Backend_Optimizer_CoreFn::ExprType>, code: String,
) -> String {
    match purust_codegen_simple_coercion(&enums, &current_mod, &expected, &actual, &code) {
        Some(("", "")) => code,
        Some((prefix, suffix)) => {
            let mut result = String::with_capacity(prefix.len() + code.len() + suffix.len());
            result.push_str(prefix); result.push_str(&code); result.push_str(suffix); result
        },
        None => reference(renames, enums, fields, current_mod, expected, actual, code),
    }
}

// A constant keyword Set in generated PureScript is a getter, not a native
// static: rebuilding its AVL tree for each emitted field is avoidable. Keep
// the exact spelling rules here and borrow the compilation-wide rename map.
fn purust_codegen_string_lookup<'a>(mut map: &'a Purs_Data_Map_Internal::Map, key: &str) -> Option<Option<&'a String>> {
    use Purs_Data_Map_Internal::Map;
    loop {
        match map {
            Map::Leaf => return Some(None),
            Map::Node(_, _, node_key, value, left, right) => {
                let Value::String(node_key) = node_key.resolve() else { return None; };
                match key.cmp(node_key.as_str()) {
                    std::cmp::Ordering::Less => map = left,
                    std::cmp::Ordering::Greater => map = right,
                    std::cmp::Ordering::Equal => return match value.resolve() {
                        Value::String(value) => Some(Some(value)), _ => None,
                    },
                }
            }
        }
    }
}

fn purust_codegen_field_base_pure(mut field: String) -> String {
    if matches!(field.as_str(), "crate" | "self" | "Self" | "super") {
        field.push_str("_kw"); return field;
    }
    let mut name = purust_codegen_sanitize_ident(field);
    if name == "_" { return "_underscore".into(); }
    if name.as_bytes().first().is_some_and(u8::is_ascii_digit) { name.insert(0, '_'); }
    name
}

pub fn Purust_CodeGen_fieldBaseImpl(
    reference: Func2<std::rc::Rc<Purs_Data_Map_Internal::Map>, String, String>,
    renames: std::rc::Rc<Purs_Data_Map_Internal::Map>, field: String,
) -> String {
    match purust_codegen_string_lookup(&renames, &field) {
        Some(Some(name)) => name.clone(),
        Some(None) => purust_codegen_field_base_pure(field),
        None => reference(renames, field),
    }
}

pub fn Purust_CodeGen_recordFieldIdentImpl(
    reference: Func2<std::rc::Rc<Purs_Data_Map_Internal::Map>, String, String>,
    renames: std::rc::Rc<Purs_Data_Map_Internal::Map>, field: String,
) -> String {
    if matches!(field.as_str(),
        "abstract" | "async" | "await" | "become" | "box" | "const" | "continue" | "do"
        | "dyn" | "else" | "enum" | "extern" | "false" | "final" | "for" | "impl" | "in"
        | "macro" | "match" | "override" | "priv" | "return" | "static" | "struct"
        | "trait" | "true" | "try" | "typeof" | "unsafe" | "unsized" | "virtual"
        | "where" | "while" | "yield") {
        let mut result = String::with_capacity(field.len() + 2);
        result.push_str("r#"); result.push_str(&field); return result;
    }
    match purust_codegen_string_lookup(&renames, &field) {
        Some(Some(name)) => name.clone(),
        Some(None) => purust_codegen_field_base_pure(field),
        None => reference(renames, field),
    }
}

fn purust_codegen_record_name(renames: &Purs_Data_Map_Internal::Map, fields: &Value) -> Option<String> {
    let fields = purust_codegen_string_array(fields)?;
    let mut names = Vec::with_capacity(fields.len());
    for field in fields.iter() {
        let Value::String(name) = field.resolve() else { return None; };
        names.push(name.as_str());
    }
    // Match the native Data.Ord String comparator. Deduplicate original labels
    // before applying renames: distinct labels may deliberately share spellings.
    names.sort_unstable(); names.dedup();
    let mut result = String::with_capacity(7 + names.iter().map(|s| s.len() + 1).sum::<usize>());
    result.push_str("Record_");
    for (index, field) in names.iter().enumerate() {
        if index > 0 { result.push('_'); }
        match purust_codegen_string_lookup(renames, field)? {
            Some(name) => result.push_str(name),
            None => result.push_str(&purust_codegen_field_base_pure((*field).to_owned())),
        }
    }
    if result.len() == 7 { result.push('a'); }
    else if result == "Record_a" { result.insert_str(0, "Closed"); }
    Some(result)
}

pub fn Purust_CodeGen_recordStructNameImpl(
    reference: Func2<std::rc::Rc<Purs_Data_Map_Internal::Map>, Value, String>,
    renames: std::rc::Rc<Purs_Data_Map_Internal::Map>, fields: Value,
) -> String {
    match purust_codegen_record_name(&renames, &fields) {
        Some(name) => name,
        None => reference(renames, fields),
    }
}
