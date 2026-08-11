const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const target = `  App fn args -> 
    let argsArray = NonEmptyArray.toArray args
        argsFree = map freeVariables argsArray
        aliveForFn = Set.union alive (Array.foldl Set.union Set.empty argsFree)
        fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForFn fn
        
        argsCodeArray = Array.mapWithIndex (\\i arg -> 
            let subsequentArgsFree = Array.drop (i + 1) argsFree
                aliveForArg = Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree)
            in codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg
          ) argsArray
        argsCode = String.joinWith ", " argsCodeArray
        
        fnTy = inferTypeExpr currentMod (Map.empty) bound fn
        fnArity = case fnTy of
          Func a _ -> Array.length a
          _ -> 0
        
        numProvided = Array.length (NonEmptyArray.toArray args)
    in if fnArity > numProvided then
         let numMissing = fnArity - numProvided
             missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
             missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
             closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
         in "std::rc::Rc::new(move |" <> missingArgs <> "| (" <> fnCode <> ")(" <> closureArgs <> "))"
       else
         "(" <> fnCode <> ")(" <> argsCode <> ")"`;

const replacement = `  App fn args -> 
    let getInner :: NeutralExpr -> NeutralExpr
        getInner (NeutralExpr (Typed _ inner)) = getInner inner
        getInner e = e
        isTopLevelFn = case getInner fn of
                 NeutralExpr (Var (Qualified mbMod (Ident name))) -> 
                   let modPrefix = case mbMod of
                         Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
                         Nothing -> ""
                       fullName = modPrefix <> sanitizeIdent name
                   in Map.member (if fullName == "main" then "main" else fullName) aritiesMap
                 _ -> false
                 
        argsArray = NonEmptyArray.toArray args
        argsFree = map freeVariables argsArray
        aliveForFn = Set.union alive (Array.foldl Set.union Set.empty argsFree)
        fnCode = codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForFn fn
        
        argsCodeArray = Array.mapWithIndex (\\i arg -> 
            let subsequentArgsFree = Array.drop (i + 1) argsFree
                aliveForArg = Set.union alive (Array.foldl Set.union Set.empty subsequentArgsFree)
            in codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound aliveForArg arg
          ) argsArray
        argsCode = String.joinWith ", " argsCodeArray
        
        fnTy = inferTypeExpr currentMod aritiesMap bound fn
        fnArity = case fnTy of
          Func a _ -> Array.length a
          _ -> 0
        
        numProvided = Array.length (NonEmptyArray.toArray args)
    in if isTopLevelFn then
         if fnArity > numProvided then
           let numMissing = fnArity - numProvided
               missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
               missingArgs = String.joinWith ", " (map (\\v -> "mut " <> v <> ": UnknownType") missingVars)
               closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
           in "perceus_ptr::PerceusPtr::new(Record_a { a: 0, b: None, c: None, ccc: None, d: None, x: None, Applicative0: None, pure: None, show: None, discard: None, proof: None, call: Some(std::rc::Rc::new(move |" <> missingArgs <> "| -> UnknownType {\\n    (" <> fnCode <> ")(" <> closureArgs <> ")\\n})) })"
         else
           "(" <> fnCode <> ")(" <> argsCode <> ")"
       else
         Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") fnCode argsCodeArray`;

code = code.replace(target, replacement);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
