import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(/                Nothing -> \n                   let fnCode = codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set\.empty false innerExpr\n                       argsCodeArray = map \(\\p -> sanitizeIdent p <> "\.clone\(\)"\) deduped\n                   in Array\.foldl \(\\acc argCode -> "\(" <> acc <> "\)\.call\.clone\(\)\.unwrap\(\)\(" <> argCode <> "\)"\) fnCode argsCodeArray/,
`                Nothing -> 
                   let fnCode = codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty false innerExpr
                       argsCodeArray = map (\\p -> sanitizeIdent p <> ".clone()") deduped
                       callCode = Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") fnCode argsCodeArray
                   in boxUnbox retType Any callCode`);

// Wait! Also if extracted is Just (Tuple _ body), we should box the body to retType!
code = code.replace(/              bodyCodeRaw = case extracted of\n                Just \(Tuple _ body\) -> codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set\.empty false body\n                Nothing ->/,
`              bodyCodeRaw = case extracted of
                Just (Tuple _ body) -> 
                    let bodyRaw = codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty false body
                        bodyTy = inferTypeExpr modNameStr aritiesMap bound body
                    in boxUnbox retType bodyTy bodyRaw
                Nothing ->`);

// Let's also do the same for isAbs (the non-Func branch)
code = code.replace(/                  bodyCodeRaw = codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set\.empty false body\n                in { paramsCode: pCode, retCode: "crate::UnknownType", bodyCode: bodyCodeRaw, isFunc: true }/,
`                  bodyRaw = codegenExpr_ modNameStr allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty false body
                  bodyTy = inferTypeExpr modNameStr aritiesMap bound body
                  bodyCodeRaw = boxUnbox Any bodyTy bodyRaw
                in { paramsCode: pCode, retCode: "crate::UnknownType", bodyCode: bodyCodeRaw, isFunc: true }`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
