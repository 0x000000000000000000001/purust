const fs = require('fs');
let code = fs.readFileSync('src/Main.purs', 'utf8');

if (!code.includes('PureScript.Backend.Optimizer.FfiSupport')) {
  code = code.replace('import Purust.CodeGen (codegenModule)', 
  `import Purust.CodeGen (codegenModule)\nimport PureScript.Backend.Optimizer.FfiSupport (findFfiFile)`);
}

code = code.replace(
  /FS\.writeTextFile UTF8 \(outDir <> "\/src\/main\.rs"\) rsFile/,
  `ffiPathMb <- findFfiFile ".rs" [] (Just "../") modNameStr (Just coreFnMod.path)
          ffiContent <- case ffiPathMb of
            Just ffiPath -> FS.readTextFile UTF8 ffiPath
            Nothing -> pure ""

          FS.writeTextFile UTF8 (outDir <> "/src/main.rs") (rsFile <> "\\n\\n" <> ffiContent)`
);

fs.writeFileSync('src/Main.purs', code);
