import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');

code = code.replace(
    /in "pub fn " <> modPrefix <> sanitizeIdent \(unwrap name\) <> "\(" <> String\.joinWith ", " args <> "\) -> UnknownType \{ UnknownType::new\(Record_a \{ \.\.Default::default\(\) \}\) \}\\n"/g,
    `let retTyStr = codegenExprType true (extractFinalRetType ty)
                    let defaultRet = case retTyStr of
                          "i64" -> "0"
                          "f64" -> "0.0"
                          "bool" -> "false"
                          "char" -> "'\\\\0'"
                          "String" -> "String::new()"
                          _ -> "UnknownType::new(Record_a { ..Default::default() })"
                in "pub fn " <> modPrefix <> sanitizeIdent (unwrap name) <> "(" <> String.joinWith ", " args <> ") -> " <> retTyStr <> " { " <> defaultRet <> " }\\n"`
);

fs.writeFileSync('src/Main.purs', code);
