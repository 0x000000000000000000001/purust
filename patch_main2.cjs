const fs = require('fs');
let code = fs.readFileSync('src/Main.purs', 'utf8');

if (!code.includes('import Effect.Console as Console')) {
  code = code.replace('import PureScript.Backend.Optimizer.FfiSupport (findFfiFile)', 
  `import PureScript.Backend.Optimizer.FfiSupport (findFfiFile)\nimport Effect.Console as Console`);
}

code = code.replace(
  /ffiContent <- case ffiPathMb of/,
  `Console.log ("Looking for FFI for " <> modNameStr <> " path: " <> show coreFnMod.path <> " found: " <> show ffiPathMb)
          ffiContent <- case ffiPathMb of`
);

fs.writeFileSync('src/Main.purs', code);
