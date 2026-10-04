fn purust_foreign_declarations(source: &str) -> Vec<String> {
    // These patterns are regular: the linear-time engine must scan arbitrarily
    // large modules without fancy-regex's backtracking search limit.
    static DECLARATIONS: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let mut clean = String::new();
    let mut i = 0;
    while i < source.len() {
        let rest = &source[i..];
        if rest.starts_with("--") {
            i = rest.find('\n').map(|n| i + n).unwrap_or(source.len());
        } else if rest.starts_with("{-") {
            i += 2;
            let mut depth = 1;
            while i < source.len() && depth > 0 {
                if source[i..].starts_with("{-") { depth += 1; i += 2; }
                else if source[i..].starts_with("-}") { depth -= 1; i += 2; }
                else {
                    let ch = source[i..].chars().next().unwrap();
                    if ch == '\n' { clean.push(ch); }
                    i += ch.len_utf8();
                }
            }
        } else if rest.starts_with('"') {
            let triple = rest.starts_with("\"\"\"");
            i += if triple { 3 } else { 1 };
            while i < source.len() {
                if triple && source[i..].starts_with("\"\"\"") { i += 3; break; }
                if !triple && source[i..].starts_with('"') { i += 1; break; }
                if !triple && source[i..].starts_with('\\') { i += 1; }
                if i == source.len() { break; }
                let ch = source[i..].chars().next().unwrap();
                if ch == '\n' { clean.push(ch); }
                i += ch.len_utf8();
            }
            clean.push(' ');
        } else {
            let ch = rest.chars().next().unwrap();
            clean.push(ch);
            i += ch.len_utf8();
        }
    }
    // A word boundary would backtrack over a trailing apostrophe. Either kind
    // separator (`::` or `∷`) keeps the complete source identifier as the key.
    DECLARATIONS.get_or_init(|| regex::Regex::new(r"(?m)^foreign\s+import\s+data\s+([A-Z][A-Za-z0-9_']*)\s*(?:::|∷)").unwrap())
        .captures_iter(&clean).map(|m| m[1].to_owned()).collect()
}

fn purust_native_definition(rust: &str, name: &str) -> bool {
    static USES: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let name = name.replace('\'', "_prime");
    let escaped: String = name.chars().flat_map(|ch| {
        if ".*+?^${}()|[]\\".contains(ch) { vec!['\\', ch] } else { vec![ch] }
    }).collect();
    if regex::Regex::new(&format!(r"\b(?:struct|enum|type|trait)\s+{}\b", escaped)).unwrap().is_match(rust) { return true; }
    let uses = USES.get_or_init(|| regex::Regex::new(r"\bpub\s+use\s+([^;]+);").unwrap());
    for captures in uses.captures_iter(rust) {
        for part in captures[1].replace(['{', '}'], "").split(',') {
            if part.trim().rsplit("::").next().unwrap().split_whitespace().last() == Some(name.as_str()) { return true; }
        }
    }
    false
}

pub fn Purust_ForeignTypes_foreignTypeForwards(source: String, rust: String) -> String {
    purust_foreign_declarations(&source).iter().map(|name| {
        if purust_native_definition(&rust, name) { format!("// Native FFI type declaration: {}\n", name) }
        else { format!("// Opaque FFI declaration only: no native values can be constructed.\n#[derive(Clone, Debug)]\npub enum {} {{}}\n", name.replace('\'', "_prime")) }
    }).collect::<Vec<_>>().join("\n")
}

pub fn Purust_ForeignTypes_foreignUnboundTypes(source: String, rust: String) -> Value {
    let mut seen = std::collections::HashSet::new();
    mk_array(purust_foreign_declarations(&source).into_iter()
        .filter(|name| seen.insert(name.clone()) && !purust_native_definition(&rust, name))
        .map(Value::String).collect())
}
