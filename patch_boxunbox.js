import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// Let's add a debug trace in boxUnbox to see WHY it's unboxing!
code = code.replace(/boxUnbox :: ExprType -> ExprType -> String -> String\nboxUnbox expected actual code = \n  let expStr = codegenExprType true expected\n      actStr = codegenExprType true actual/,
`boxUnbox :: ExprType -> ExprType -> String -> String
boxUnbox expected actual code = 
  let expStr = codegenExprType true expected
      actStr = codegenExprType true actual
      -- debug = Debug.trace ("boxUnbox: exp=" <> expStr <> ", act=" <> actStr <> " for code=" <> code) \_ -> unit
`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
