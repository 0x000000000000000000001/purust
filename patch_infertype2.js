import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const appInfer = `
  App fn args -> 
    case getInner fn of
      NeutralExpr (Var (Qualified _ (Ident "not"))) -> Boolean
      NeutralExpr (Var (Qualified (Just (ModuleName "Data.HeytingAlgebra")) (Ident "not"))) -> Boolean
      _ -> case unwrapType (inferTypeExpr currentMod aritiesMap bound fn) of
        Func argTypes retTy -> 
          let expectedCount = Array.length argTypes
              providedCount = NonEmptyArray.length args
          in if expectedCount > providedCount then
               Func (Array.drop providedCount argTypes) retTy
             else retTy
        _ -> Any
`;

code = code.replace(/  App fn args -> \n    case unwrapType \(inferTypeExpr currentMod aritiesMap bound fn\) of\n      Func argTypes retTy -> \n        let expectedCount = Array\.length argTypes\n            providedCount = NonEmptyArray\.length args\n        in if expectedCount > providedCount then\n             Func \(Array\.drop providedCount argTypes\) retTy\n           else retTy\n      _ -> Any/,
appInfer);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
