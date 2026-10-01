fn purust_cargo_declaration(path: &str, text: &str) -> String {
    let fail = |message: &str| -> ! { panic!("Invalid FFI Cargo declaration {}: {}", path, message) };
    let declaration: serde_json::Value = serde_json::from_str(text).unwrap_or_else(|_| fail("invalid JSON"));
    let keys = |value: &serde_json::Value, allowed: &[&str]| {
        if !value.as_object().is_some_and(|o| o.keys().all(|k| allowed.contains(&k.as_str()))) {
            fail(&format!("expected only {}", allowed.join(", ")));
        }
    };
    keys(&declaration, &["schema", "dependencies"]);
    if declaration["schema"].as_f64() != Some(1.0) || !declaration["dependencies"].is_object() {
        fail("expected schema 1 and a dependencies object");
    }
    let name_re = fancy_regex::Regex::new(r"^[a-z][a-z0-9_-]*$").unwrap();
    let version_re = fancy_regex::Regex::new(r"^=(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$").unwrap();
    let feature_re = fancy_regex::Regex::new(r"^[a-zA-Z0-9_][a-zA-Z0-9_+.-]*$").unwrap();
    let reserved = ["purust-core", "perceus-ptr", "fancy-regex", "mimalloc", "tokio"];
    let mut names = std::collections::HashSet::new();
    let mut result = String::new();
    let mut dependencies: Vec<_> = declaration["dependencies"].as_object().unwrap().iter().collect();
    dependencies.sort_by(|a, b| a.0.cmp(b.0));
    for (name, dependency) in dependencies {
        if !name_re.is_match(name).unwrap() { fail(&format!("unsupported crate name: {}", name)); }
        let normalized = name.replace('_', "-");
        if reserved.contains(&normalized.as_str()) || normalized.starts_with("purs-") {
            fail(&format!("reserved dependency: {}", name));
        }
        if !names.insert(normalized) { fail(&format!("colliding dependency: {}", name)); }
        keys(dependency, &["version", "features", "default-features"]);
        let version = dependency["version"].as_str().unwrap_or("");
        if !version_re.is_match(version).unwrap() {
            fail(&format!("{}: version must be an exact stable =major.minor.patch", name));
        }
        let mut fields = vec![format!("version = {}", serde_json::to_string(version).unwrap())];
        if let Some(value) = dependency.get("default-features") {
            if !value.is_boolean() { fail(&format!("{}: default-features must be boolean", name)); }
            fields.push(format!("default-features = {}", value));
        }
        if let Some(features) = dependency.get("features") {
            let mut seen = std::collections::HashSet::new();
            let Some(features) = features.as_array().filter(|items| items.iter().all(|f| f.as_str()
                .is_some_and(|s| feature_re.is_match(s).unwrap() && seen.insert(s)))) else {
                fail(&format!("{}: expected distinct feature names", name));
            };
            fields.push(format!("features = [{}]", features.iter().map(|f| f.to_string()).collect::<Vec<_>>().join(", ")));
        }
        result.push_str(&format!("{} = {{ {} }}\n", name, fields.join(", ")));
    }
    result
}

pub fn Purust_FfiCargo_loadFfiCargo(ffi_path: String) -> Value {
    Value::Func1(Func1::Shared(std::rc::Rc::new(move |_| {
        let path = format!("{}.cargo.json", purust_string_to_utf8_lossy(&ffi_path));
        let source = match std::fs::read_to_string(&path) {
            Ok(source) => source,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Value::String(String::new()),
            Err(error) => panic!("{}: {}", path, error),
        };
        Value::String(purust_string_from_utf8(&purust_cargo_declaration(&path, &source)))
    })))
}
