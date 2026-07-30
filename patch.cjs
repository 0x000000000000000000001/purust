const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

// 1. Fix `isFunc` in `codegenModule` to use `inferTypeExpr`
code = code.replace(/isFunc = case expr of\n[\s\S]+?_ -> false/m, `isFunc = case inferTypeExpr modNameStr Map.empty expr of\n                Func _ _ -> true\n                _ -> false`);

// 2. Fix `codegenBindingGroup` to eta-expand functions
code = code.replace(/let isAbs = case innerExpr of\n[\s\S]+?else\n[\s\S]+?in \{ paramsCode: pCode, retCode: "UnknownType", bodyCode: codegenExpr modNameStr allZeroArity allMacroBindings mbLoop \(Map.union bound aritiesMap\) body, isFunc: true \}/m, `let ty = inferTypeExpr modNameStr Map.empty innerExpr
            in case ty of
              Func args retTy ->
                let
                  missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) args
                  pCode = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
                  closureArgs = String.joinWith ", " (map (\\v -> v <> ".clone()") missingVars)
                  innerCode = codegenExpr modNameStr allZeroArity allMacroBindings mbLoop (Map.union bound aritiesMap) innerExpr
                  bodyCode = "(" <> innerCode <> ")(" <> closureArgs <> ")"
                in { paramsCode: pCode, retCode: "UnknownType", bodyCode: bodyCode, isFunc: true }
              _ -> 
                { paramsCode: "", retCode: "UnknownType", bodyCode: codegenExpr modNameStr allZeroArity allMacroBindings mbLoop (Map.union bound aritiesMap) innerExpr, isFunc: false }`);

// 3. Fix `App fn args` to eta-expand partial applications
const appReplace = `_ -> 
         let fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound fn
             argsCodeArray = map (codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound) (NonEmptyArray.toArray args)
             argsCode = String.joinWith ", " argsCodeArray
             
             fnTy = inferTypeExpr currentMod bound fn
             fnArity = case fnTy of
               Func a _ -> Array.length a
               _ -> 0
             
             numProvided = Array.length (NonEmptyArray.toArray args)
         in if fnArity > numProvided then
              let numMissing = fnArity - numProvided
                  missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
                  missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
                  closureArgs = String.joinWith ", " (argsCodeArray <> map (\\v -> v <> ".clone()") missingVars)
              in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"
            else
              "(" <> fnCode <> ")(" <> argsCode <> ")"`;

code = code.replace(/_ -> \n\s*let fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound fn\n\s*argsCode = String.joinWith ", " \(map \(codegenExpr currentMod allZeroArity allMacroBindings mbLoop bound\) \(NonEmptyArray.toArray args\)\)\n\s*in "\(" <> fnCode <> "\)\(" <> argsCode <> "\)"/m, appReplace);

fs.writeFileSync(file, code);
