import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/            in { paramsCode: "", retCode: codegenExprType true inferredType, bodyCode: codegenExpr_ modNameStr allZeroArity allMacroBindings Nothing aritiesMap Map\.empty Set\.empty false innerExpr, isFunc: false }/,
`            in { 
              paramsCode: "", 
              retCode: codegenExprType true inferredType, 
              bodyCode: 
                let bodyRaw = codegenExpr_ modNameStr allZeroArity allMacroBindings Nothing aritiesMap Map.empty Set.empty false innerExpr
                    bodyTy = inferTypeExpr modNameStr aritiesMap Map.empty innerExpr
                in boxUnbox inferredType bodyTy bodyRaw, 
              isFunc: false 
            }`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
