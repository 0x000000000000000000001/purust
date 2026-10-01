// This is deliberately not FFI: PureDependency has no foreign declarations.
// Adjacent standalone Rust sources must not be injected into generated crates.
compile_error!("Unrelated Rust source was incorrectly loaded as FFI");
