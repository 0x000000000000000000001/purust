import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');
code = code.replace(
    '                    args = Array.mapWithIndex (\\i argTy -> "mut a" <> show i <> ": " <> codegenExprType true argTy) argTypes',
    '                    args = Array.mapWithIndex (\\i argTy -> "mut a" <> show i <> ": " <> codegenExprType true argTy) argTypes\n                    _ = Debug.trace ("genFallback " <> unwrap name <> " args: " <> show args) \\_ -> unit'
);
fs.writeFileSync('src/Main.purs', code);
