import fs from 'fs';
let code = fs.readFileSync('src/Main.purs', 'utf8');
code = code.replace(
    '          let __dummy = Debug.trace ("Found FFI for " <> modNameStr <> " at: " <> show ffiPathMb) \\_ -> unit\n          ffiContent <- case ffiPathMb of',
    '          liftEffect $ Console.log ("Found FFI for " <> modNameStr <> " at: " <> show ffiPathMb)\n          ffiContent <- case ffiPathMb of'
);
fs.writeFileSync('src/Main.purs', code);
