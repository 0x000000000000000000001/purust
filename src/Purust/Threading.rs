// The scanner protects comments and literals, including nested comments, raw
// strings and chars. Rust lifetimes remain code, as in the JavaScript backend.
fn purust_map_rust_code(source: &str, mut transform: impl FnMut(&str) -> String) -> String {
    let raw = fancy_regex::Regex::new(r#"^(?:br|cr|r)(#*)\""#).unwrap();
    let character = fancy_regex::Regex::new(r"^'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|[^\r\n])|[^'\\\r\n])'").unwrap();
    let mut result = String::new();
    let (mut start, mut i) = (0, 0);
    while i < source.len() {
        let rest = &source[i..];
        let mut protected = None;
        if rest.starts_with("//") {
            protected = Some(rest.find('\n').map(|n| i + n).unwrap_or(source.len()));
        } else if rest.starts_with("/*") {
            let (mut end, mut depth) = (i + 2, 1);
            while end < source.len() && depth > 0 {
                if source[end..].starts_with("/*") { depth += 1; end += 2; }
                else if source[end..].starts_with("*/") { depth -= 1; end += 2; }
                else { end += source[end..].chars().next().unwrap().len_utf8(); }
            }
            protected = Some(end);
        } else {
            let boundary = i == 0 || !source[..i].chars().next_back().unwrap().is_ascii_alphanumeric()
                && !source[..i].ends_with('_');
            if let Some(captures) = raw.captures(rest).unwrap().filter(|_| boundary) {
                let opening = captures.get(0).unwrap().end();
                let close = format!("\"{}", &captures[1]);
                protected = Some(rest[opening..].find(&close)
                    .map(|n| i + opening + n + close.len()).unwrap_or(source.len()));
            } else if rest.starts_with('"') {
                let mut end = i + 1;
                while end < source.len() {
                    let ch = source[end..].chars().next().unwrap();
                    end += ch.len_utf8();
                    if ch == '\\' && end < source.len() { end += source[end..].chars().next().unwrap().len_utf8(); }
                    else if ch == '"' { break; }
                }
                protected = Some(end);
            } else if rest.starts_with('\'') {
                protected = character.find(rest).unwrap().map(|m| i + m.end());
            }
        }
        if let Some(end) = protected {
            result.push_str(&transform(&source[start..i]));
            result.push_str(&source[i..end]);
            start = end;
            i = end;
        } else {
            i += rest.chars().next().unwrap().len_utf8();
        }
    }
    result.push_str(&transform(&source[start..]));
    result
}

fn purust_thread_ownership(code: &str) -> String {
    let code = code.replace("use std::rc::Rc;", "use std::sync::Arc as Rc;")
        .replace("std::rc::Rc", "std::sync::Arc");
    fancy_regex::Regex::new(r"(?<!\bSync) \+ 'static").unwrap()
        .replace_all(&code, " + Send + Sync + 'static").into_owned()
}

pub fn Purust_Threading_threadedRust(source: String) -> String {
    purust_map_rust_code(&source, purust_thread_ownership)
}

pub fn Purust_Threading_threadedPrelude(source: String) -> String {
    purust_map_rust_code(&source, |code| purust_thread_ownership(code)
        .replace(") -> R>),", ") -> R + Send + Sync>),")
        .replace("dyn std::any::Any>", "dyn std::any::Any + Send + Sync>"))
}

pub fn Purust_Threading_rustModules(source: String) -> Value {
    let pattern = fancy_regex::Regex::new(r"\bPurs_([A-Za-z_][A-Za-z0-9_]*)::").unwrap();
    let mut modules = Vec::new();
    let mut seen = std::collections::HashSet::new();
    purust_map_rust_code(&source, |code| {
        for captures in pattern.captures_iter(code) {
            let name = captures.unwrap()[1].to_owned();
            if seen.insert(name.clone()) { modules.push(Value::String(name)); }
        }
        String::new()
    });
    mk_array(modules)
}
