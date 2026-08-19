import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

// The top-level function block looks like this:
//                              let n = lookupArity fullName
//                                  fnTy = fromMaybe Any (Map.lookup (if fullName == "main" then "main" else fullName) aritiesMap)
//                                  expectedArgTys = extractAllArgTypes fnTy
//                                  boxedArgs = Array.mapWithIndex (\i argCode -> 
//                                     let argExpr = fromMaybe (NeutralExpr (Var (Qualified Nothing (Ident "")))) (Array.index argsArray i)
//                                         argTy = inferTypeExpr currentMod aritiesMap bound argExpr
//                                         expectedTy = fromMaybe Any (Array.index expectedArgTys i)
//                                     in boxUnbox expectedTy argTy argCode
//                                  ) argsCodeArray
//                              in if n > 0 then
//                                if m == n then
//                                  fullName <> "(" <> String.joinWith ", " boxedArgs <> ")"
//                                else if m < n then
//                                  let missingCount = n - m
//                                      etaArgs = Array.mapWithIndex (\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
//                                      evalArgs = Array.mapWithIndex (\i _ -> "eval_arg_" <> show i) boxedArgs
//                                      letArgsCode = Array.mapWithIndex (\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\n") boxedArgs
//                                      innerArgs = evalArgs <> map (\eta -> eta <> ".clone()") etaArgs
//                                      innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
//                                      closuresCode = case Array.foldr (\etaArg (Tuple i accCode) -> 
//                                          let prevEtas = Array.take i etaArgs
//                                              clonesCode = String.joinWith " " (map (\prev -> "let mut " <> prev <> " = " <> prev <> ".clone();") prevEtas)
//                                          in Tuple (i - 1) ("perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut " <> etaArg <> ": UnknownType| -> UnknownType { " <> clonesCode <> " " <> accCode <> " })), ..Default::default() })")
//                                        ) (Tuple (missingCount - 1) innerCall) etaArgs of
//                                        Tuple _ res -> res
//                                  in "{\n" <> String.joinWith "" letArgsCode <> "    " <> closuresCode <> "\n}"
//                                else
//                                  -- Over-applied
//                                  let firstNArgs = Array.take n argsCodeArray
//                                      remainingArgs = Array.drop n argsCodeArray
//                                      baseCall = fullName <> "(" <> String.joinWith ", " firstNArgs <> ")"
//                                  in Array.foldl (\acc arg -> "(" <> acc <> ").call.clone().unwrap()(" <> arg <> ")") baseCall (Array.drop n boxedClosureArgs)

code = code.replace(/                                 let firstNArgs = Array\.take n argsCodeArray/,
`                                 let firstNArgs = Array.take n boxedArgs`);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
