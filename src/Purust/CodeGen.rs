pub fn Purust_CodeGen_sanitizeIdentImpl(_fallback: Func1<String, String>, mut input: String) -> String {
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
