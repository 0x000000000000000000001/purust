const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Patch Record_a definition
code = code.replace(
    /pub discard: Option<std::rc::Rc<dyn Fn\(UnknownType, UnknownType, UnknownType\) -> UnknownType>>," <>\n\s+"    pub show: Option<std::rc::Rc<dyn Fn\(UnknownType\) -> UnknownType>>," <>\n\s+"}\\n\\n"/,
    `pub discard: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>," <>
      "    pub show: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>," <>
      "    pub fn1: Option<std::rc::Rc<dyn Fn(UnknownType) -> UnknownType>>," <>
      "    pub fn2: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType) -> UnknownType>>," <>
      "    pub fn3: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType) -> UnknownType>>," <>
      "    pub fn4: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>," <>
      "    pub fn5: Option<std::rc::Rc<dyn Fn(UnknownType, UnknownType, UnknownType, UnknownType, UnknownType) -> UnknownType>>," <>
      "}\\n\\n"`
);

// Patch Record_a initializer in ObjectUpdate/Record literal
code = code.replace(
    /show: " <> getF "show" <> ", discard: " <> getF "discard" <> " \}\)"/,
    `show: " <> getF "show" <> ", discard: " <> getF "discard" <> ", fn1: None, fn2: None, fn3: None, fn4: None, fn5: None })"`
);

// Patch Abs
const absRegex = /in "unsafe_coerce\(std::rc::Rc::new\(move \\\|" <> paramsCode <> "\\\| -> UnknownType \{\\n" <>\n\s+drops <>\n\s+"    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound Set.empty body <> "\\n" <>\n\s+"\}\)\)"/;

const newAbs = `let numArgs = Array.length paramsArr
      mkFn = if numArgs >= 1 && numArgs <= 5 then "mk_fn" <> show numArgs else "unsafe_coerce"
    in mkFn <> "(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <>
       drops <>
       "    " <> codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound Set.empty body <> "\\n" <>
       "}))"`;

code = code.replace(absRegex, newAbs);

// Patch App
const appRegex = /in if fnArity > numProvided then\n\s+let numMissing = fnArity - numProvided\n\s+missingVars = Array.mapWithIndex \(\\\\i _ -> "c_" <> show i\) \(Array.replicate numMissing unit\)\n\s+missingArgs = String.joinWith ", " \(map \(\\\\v -> "mut " <> v <> ": UnknownType"\) missingVars\)\n\s+closureArgs = String.joinWith ", " \(argsCodeArray <> missingVars\)\n\s+in "std::rc::Rc::new\(move \\\|" <> missingArgs <> "\\\| \(" <> fnCode <> "\)\(" <> closureArgs <> "\)\)"\n\s+else\n\s+"\(" <> fnCode <> "\)\(" <> argsCode <> "\)"/;

const newApp = `isFunc = case fnTy of
           Func _ _ -> true
           _ -> false
    in if isFunc && fnArity > numProvided then
         let numMissing = fnArity - numProvided
             missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
             missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
             closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
         in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"
       else if isFunc then
         "(" <> fnCode <> ")(" <> argsCode <> ")"
       else
         "(" <> fnCode <> ".fn" <> show numProvided <> ".clone().unwrap())(" <> argsCode <> ")"`;

code = code.replace(appRegex, newApp);

// Patch CtorDef
const ctorDefRegex = /CtorDef \(Qualified mbMod _\) _ \(ProperName tyNameStr\) \(Ident ctorName\) fields ->[^]+?\n\s+"\}\)\)"/m;
const oldCtorDefFallback = /CtorDef _ _ _ _ -> "unsafe_coerce\(0\)"/;

const newCtorDef = `CtorDef _ (ProperName tyNameStr) (Ident ctorName) fields ->
    let
      modPrefix = String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_"
      fullTyName = modPrefix <> tyNameStr
      numArgs = Array.length fields
      paramsArr = Array.mapWithIndex (\\i _ -> "c_" <> show i) fields
      paramsCode = String.joinWith ", " (map (\\p -> "mut " <> p <> ": UnknownType") paramsArr)
      fieldsCode = if Array.null paramsArr then "" else "(" <> String.joinWith ", " paramsArr <> ")"
      mkFn = if numArgs >= 1 && numArgs <= 5 then "mk_fn" <> show numArgs else "unsafe_coerce"
    in mkFn <> "(std::rc::Rc::new(move |" <> paramsCode <> "| -> UnknownType {\\n" <>
       "    unsafe_coerce(std::rc::Rc::new(" <> fullTyName <> "::" <> ctorName <> fieldsCode <> "))\\n" <>
       "}))"`;

if (code.match(ctorDefRegex)) {
  code = code.replace(ctorDefRegex, newCtorDef);
} else {
  code = code.replace(oldCtorDefFallback, newCtorDef);
}

fs.writeFileSync('src/Purust/CodeGen.purs', code);
