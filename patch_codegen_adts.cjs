const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. In codegenModule, change the Enum generation to prefix with modNameStr
code = code.replace(
    '"#[derive(Clone)]\\npub enum " <> decl.typeName <> " {\\n" <>',
    '"#[derive(Clone)]\\npub enum " <> modNameStr <> "_" <> decl.typeName <> " {\\n" <>'
);

// 2. In codegenExprType, change ADT generation
code = code.replace(
    'ADT name _ -> Array.last name # fromMaybe "UnknownType"',
    'ADT name _ -> "std::rc::Rc<" <> String.joinWith "_" name <> ">"'
);

// 3. In codegenExpr, for Constructor app, wrap in Rc::new
code = code.replace(
    'in tyNameStr <> "::" <> ctorName <> fieldsCode',
    'in "std::rc::Rc::new(" <> tyNameStr <> "::" <> ctorName <> fieldsCode <> ")"'
);

// 4. In codegenExpr, for ADTAccessor, deref the Rc when matching
code = code.replace(
    'in "(match " <> baseStr <> " { " <> tyNameStr <> "::" <> ctorName <> "(" <> prefix <> "val, ..) => val, _ => unimplemented!() })"',
    'in "(match &*" <> baseStr <> " { " <> tyNameStr <> "::" <> ctorName <> "(" <> prefix <> "val, ..) => val.clone(), _ => unimplemented!() })"'
);

// 5. In codegenExpr, for Case expression pattern matching, we ALSO need to deref!
// Let's check how case is compiled. It uses `match {varName} { ... }`.
// Wait, if it's an Rc, we must `match &*{varName} { ... }`.
// The match generation is at line 349: `"match " <> valName <> ".dup() {\n"`
// If `valName` is an Rc, we can't `dup()` it directly if dup() is not on Rc.
// Actually, `Rc` has `clone()`.
// But wait, the case matching is already quite complex. Let's start with just fixing the known issues.

fs.writeFileSync('src/Purust/CodeGen.purs', code);
