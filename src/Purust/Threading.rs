// Visit only code spans. Literals and comments are left byte-exact, including
// nested comments, raw strings, Unicode characters and Rust lifetimes.
fn purust_rust_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}

fn purust_visit_rust_code(source: &str, mut visit: impl FnMut(usize, usize)) {
    static CHARACTER: std::sync::OnceLock<fancy_regex::Regex> = std::sync::OnceLock::new();
    let bytes = source.as_bytes();
    let (mut start, mut i) = (0, 0);
    while i < bytes.len() {
        let rest = &source[i..];
        let mut protected = None;
        if rest.starts_with("//") {
            protected = Some(rest.find('\n').map(|n| i + n).unwrap_or(bytes.len()));
        } else if rest.starts_with("/*") {
            let (mut end, mut depth) = (i + 2, 1);
            while end < bytes.len() && depth > 0 {
                if source[end..].starts_with("/*") { depth += 1; end += 2; }
                else if source[end..].starts_with("*/") { depth -= 1; end += 2; }
                else { end += source[end..].chars().next().unwrap().len_utf8(); }
            }
            protected = Some(end);
        } else {
            // Raw string recognition is needed only at r/br/cr, at a JS-style
            // ASCII word boundary. No regex is run at every ordinary character.
            let boundary = i == 0 || !purust_rust_word(bytes[i - 1]);
            let prefix = if bytes[i] == b'r' { 1 }
                else if rest.starts_with("br") || rest.starts_with("cr") { 2 }
                else { 0 };
            if boundary && prefix != 0 {
                let mut opening = i + prefix;
                while opening < bytes.len() && bytes[opening] == b'#' { opening += 1; }
                if bytes.get(opening) == Some(&b'"') {
                    let close = format!("\"{}", &source[i + prefix..opening]);
                    protected = Some(source[opening + 1..].find(&close)
                        .map(|n| opening + 1 + n + close.len()).unwrap_or(bytes.len()));
                }
            }
            if protected.is_none() && bytes[i] == b'"' {
                let mut end = i + 1;
                while end < bytes.len() {
                    let ch = source[end..].chars().next().unwrap();
                    end += ch.len_utf8();
                    if ch == '\\' && end < bytes.len() { end += source[end..].chars().next().unwrap().len_utf8(); }
                    else if ch == '"' { break; }
                }
                protected = Some(end);
            } else if protected.is_none() && bytes[i] == b'\'' {
                let character = CHARACTER.get_or_init(|| fancy_regex::Regex::new(
                    r"^'(?:\\(?:u\{[0-9a-fA-F_]+\}|x[0-9a-fA-F]{2}|[^\r\n])|[^'\\\r\n])'"
                ).unwrap());
                protected = character.find(rest).unwrap().map(|m| i + m.end());
            }
        }
        if let Some(end) = protected {
            visit(start, i);
            start = end;
            i = end;
        } else {
            i += if bytes[i].is_ascii() { 1 } else { rest.chars().next().unwrap().len_utf8() };
        }
    }
    visit(start, source.len());
}

fn purust_map_rust_code(source: &str, mut transform: impl FnMut(&str, &mut String)) -> String {
    let mut result = String::with_capacity(source.len());
    let mut copied = 0;
    purust_visit_rust_code(source, |start, end| {
        result.push_str(&source[copied..start]);
        transform(&source[start..end], &mut result);
        copied = end;
    });
    result.push_str(&source[copied..]);
    result
}

fn purust_thread_ownership(code: &str, result: &mut String) {
    let replaced;
    let code = if code.contains("std::rc::Rc") {
        replaced = code.replace("use std::rc::Rc;", "use std::sync::Arc as Rc;")
            .replace("std::rc::Rc", "std::sync::Arc");
        replaced.as_str()
    } else { code };
    let mut copied = 0;
    for (offset, _) in code.match_indices(" + 'static") {
        // Equivalent to JS /(?<!\bSync) \+ 'static/g: its word boundary is
        // ASCII, unlike the default Unicode boundary of Rust regex engines.
        let before = &code.as_bytes()[..offset];
        let synced = before.ends_with(b"Sync")
            && (before.len() == 4 || !purust_rust_word(before[before.len() - 5]));
        if !synced {
            result.push_str(&code[copied..offset]);
            result.push_str(" + Send + Sync + 'static");
            copied = offset + " + 'static".len();
        }
    }
    result.push_str(&code[copied..]);
}

pub fn Purust_Threading_threadedRust(source: String) -> String {
    purust_map_rust_code(&source, purust_thread_ownership)
}

pub fn Purust_Threading_threadedPrelude(source: String) -> String {
    purust_map_rust_code(&source, |code, result| {
        let mut owned = String::with_capacity(code.len());
        purust_thread_ownership(code, &mut owned);
        result.push_str(&owned.replace(") -> R>),", ") -> R + Send + Sync>),")
            .replace("dyn std::any::Any>", "dyn std::any::Any + Send + Sync>"));
    })
}

pub fn Purust_Threading_rustModules(source: String) -> Value {
    let mut modules = Vec::new();
    let mut seen = std::collections::HashSet::new();
    // Import discovery does not build an unused copy of all protected spans.
    purust_visit_rust_code(&source, |start, end| {
        let code = &source[start..end];
        let bytes = code.as_bytes();
        for (offset, _) in code.match_indices("Purs_") {
            if offset > 0 && purust_rust_word(bytes[offset - 1]) { continue; }
            let first = offset + 5;
            if !bytes.get(first).is_some_and(|b| b.is_ascii_alphabetic() || *b == b'_') { continue; }
            let mut last = first + 1;
            while last < bytes.len() && purust_rust_word(bytes[last]) { last += 1; }
            if bytes.get(last..last + 2) == Some(b"::") {
                let name = &code[first..last];
                if seen.insert(name.to_owned()) { modules.push(Value::String(name.to_owned())); }
            }
        }
    });
    mk_array(modules)
}
