const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const genAppCode = `
genApp :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> NeutralExpr -> Array NeutralExpr -> String
genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn argsArray =
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
        
        numProvided = Array.length argsArray
    in if isTopLevelFn then
         if fnArity > numProvided then
           let numMissing = fnArity - numProvided
               missingVars = Array.mapWithIndex (\\i _ -> "c_" <> show i) (Array.replicate numMissing unit)
               closureArgs = String.joinWith ", " (argsCodeArray <> missingVars)
               callCode = fnCode <> "(" <> closureArgs <> ")"
               
               wrapClosure :: Int -> String -> String
               wrapClosure idx acc =
                   if idx < 0 then acc
                   else "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut c_" <> show idx <> ": UnknownType| -> UnknownType {\\n    " <> wrapClosure (idx - 1) acc <> "\\n})), ..Default::default() })"
                   
           in wrapClosure (numMissing - 1) callCode
         else if fnArity < numProvided then
           let extraArgs = Array.drop fnArity argsCodeArray
               callCode = "(" <> fnCode <> "(" <> String.joinWith ", " (Array.take fnArity argsCodeArray) <> "))"
           in Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") callCode extraArgs
         else
           "(" <> fnCode <> ")(" <> argsCode <> ")"
       else
         Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") fnCode argsCodeArray

genAbs :: String -> Set.Set String -> Set.Set String -> Maybe { name :: String, params :: Array String } -> Map.Map String ExprType -> Map.Map String ExprType -> Set.Set String -> Array String -> NeutralExpr -> String
genAbs currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive paramsArr body =
    let
      initialState = { freeVars: freeVariables body, isInnermost: true, code: codegenExpr currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound Set.empty body }
      
      finalState = Array.foldr (\\p st -> 
          let
             pCode = (if p == "_" then "" else "mut ") <> p <> ": UnknownType"
             neededByInner = st.freeVars
             pIsUsed = Set.member p neededByInner
             dropsCode = if p /= "_" && not pIsUsed then "    " <> p <> ".drop_explicit();\\n" else ""
             thisClosureCaptures = Set.delete p neededByInner
             clonesCode = if st.isInnermost then "" else 
                 let toClone = Array.filter (\\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity)) (Array.fromFoldable neededByInner)
                 in String.joinWith "" (map (\\v -> "    let mut " <> v <> " = " <> v <> ".clone();\\n") toClone)
             newCode = "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |" <> pCode <> "| -> UnknownType {\\n" <>
                       clonesCode <> dropsCode <> "    " <> st.code <> "\\n" <>
                       "})), ..Default::default() })"
          in { freeVars: thisClosureCaptures, isInnermost: false, code: newCode }
        ) initialState paramsArr
    in finalState.code
`;

// Insert the helper functions before codegenExpr
code = code.replace('codegenExpr :: String -> Set.Set String ->', genAppCode + '\ncodegenExpr :: String -> Set.Set String ->');

// Replace App
code = code.replace(/  App fn args -> \n[\s\S]+?(?=  UncurriedEffectApp fn args ->)/, '  App fn args -> \n    genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn (NonEmptyArray.toArray args)\n  UncurriedApp fn args ->\n    genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn args\n');

// Replace UncurriedEffectApp fallback
code = code.replace(/      _ -> "unimplemented\!\(\) \/\* Unsupported UncurriedEffectApp with fn: " <> printAST fn <> " \*\/\\n"/, '      _ -> genApp currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive fn args');

// Replace Abs
code = code.replace(/  Abs params body -> \n[\s\S]+?(?=  PrimUndefined -> "unimplemented!\(\)")/, `  Abs params body -> 
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) (NonEmptyArray.toArray params)
    in genAbs currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive paramsArr body
  UncurriedAbs params body ->
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) params
    in genAbs currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive paramsArr body
  UncurriedEffectAbs params body ->
    let
      paramsArr = map (\\(Tuple mbId lvl) -> case mbId of
        Just (Ident n) -> sanitizeIdent n
        Nothing -> "lvl_" <> show (unwrap lvl)) params
    in genAbs currentMod allZeroArity allMacroBindings mbLoop aritiesMap bound alive paramsArr body
`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
