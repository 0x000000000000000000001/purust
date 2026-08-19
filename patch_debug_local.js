import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    '  Local mbName lvl ->\n    let name = case mbName of\n          Just (Ident n) -> sanitizeIdent n\n          Nothing -> "lvl_" <> show (unwrap lvl)\n    in case Map.lookup name bound of\n      Just ty -> ty\n      Nothing -> Any',
    '  Local mbName lvl ->\n    let name = case mbName of\n          Just (Ident n) -> sanitizeIdent n\n          Nothing -> "lvl_" <> show (unwrap lvl)\n    in case Map.lookup name bound of\n      Just ty -> ty\n      Nothing -> Any' // Wait, I need to print it
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
