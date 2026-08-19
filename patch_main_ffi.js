import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');

// We need to import extractAllArgTypes and codegenExprType
code = code.replace(/import Purust\.CodeGen \(codegenModule, codegenPrelude, sanitizeIdent, getArity\)/,
`import Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, codegenExprType)`);

// We need to update genFallback
code = code.replace(/                    args = Array\.mapWithIndex \(\\i _ -> "mut a" <> show i <> ": UnknownType"\) \(Array\.replicate arity unit\)\n                in "pub fn " <> modPrefix <> sanitizeIdent \(unwrap name\) <> "\(" <> String\.joinWith ", " args <> "\) -> UnknownType { UnknownType::new\(Record_a { \.\.Default::default\(\) }\) }\\n"/,
`                    let argTypes = extractAllArgTypes ty
                        args = Array.mapWithIndex (\\i argTy -> "mut a" <> show i <> ": " <> codegenExprType true argTy) argTypes
                    in "pub fn " <> modPrefix <> sanitizeIdent (unwrap name) <> "(" <> String.joinWith ", " args <> ") -> UnknownType { UnknownType::new(Record_a { ..Default::default() }) }\\n"`);

// Note: we can't use `let ... in ...` if it's already inside a `let` block without adding a new `let` or merging bindings.
// Wait, the original was:
// let arity = getArity ty
//     args = ...
// in ...
// So we can replace it cleanly:
fs.writeFileSync('src/Main.purs', code);
