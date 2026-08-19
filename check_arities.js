import fs from 'fs';

// Let's modify CodeGen.purs to print inferredType of Data_Symbol_reifySymbol
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/        identName = if rawIdentName == "main" then "main" else modNameStr <> "_" <> rawIdentName\n        inferredType = fromMaybe Any \(Map\.lookup identName groupArities\)/,
`        identName = if rawIdentName == "main" then "main" else modNameStr <> "_" <> rawIdentName
        inferredType = fromMaybe Any (Map.lookup identName mergedArities)
        _dbg = unsafePerformEffect (if identName == "Data_Symbol_reifySymbol" then log ("reifySymbol type: " <> printType inferredType) else pure unit)`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
