const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// 1. In codegenModule, change the Enum generation to prefix with modNameStr
code = code.replace(
    /"#\\[derive\\(Clone\\)\\]\\npub enum " <> decl\.typeName <> " \{\\n" <>/g,
    `"#[derive(Clone)]\\npub enum " <> modNameStr <> "_" <> decl.typeName <> " {\\n" <>`
);

// 2. In codegenExprType, change ADT generation
code = code.replace(
    /ADT name _ -> Array\.last name # fromMaybe "UnknownType"/g,
    `ADT name _ -> "std::rc::Rc<" <> String.joinWith "_" name <> ">"`
);

// 3. In codegenExpr, for Constructor app, wrap in Rc::new
code = code.replace(
    /in tyNameStr <> "::" <> ctorName <> fieldsCode/g,
    `in "std::rc::Rc::new(" <> tyNameStr <> "::" <> ctorName <> fieldsCode <> ")"`
);

// 4. In codegenExpr, for ADTAccessor, deref the Rc when matching
code = code.replace(
    /in "\\(match " <> baseStr <> " \\{ " <> tyNameStr <> "::" <> ctorName <> "\\(" <> prefix <> "val, \.\.\\) => val, _ => unimplemented!\\(\\) \\}"/g,
    `in "(match &*" <> baseStr <> " { " <> tyNameStr <> "::" <> ctorName <> "(" <> prefix <> "val, ..) => val.clone(), _ => unimplemented!() })"`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
