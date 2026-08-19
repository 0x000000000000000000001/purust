import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldEta = `                                     etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
                                     evalArgs = Array.mapWithIndex (\\i _ -> "eval_arg_" <> show i) argsCodeArray
                                     letArgsCode = Array.mapWithIndex (\\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\\n") argsCodeArray
                                     innerArgs = evalArgs <> map (\\eta -> eta <> ".clone()") etaArgs
                                     innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                                     closuresCode = case Array.foldr (\\etaArg (Tuple i accCode) ->
                                         let prevEtas = Array.take i etaArgs
                                             clonesCode = String.joinWith "" (map (\\arg -> "    let mut " <> arg <> " = " <> arg <> ".clone();\\n") (evalArgs <> prevEtas))
                                         in Tuple (i - 1) ("perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut " <> etaArg <> ": UnknownType| -> UnknownType {\\n" <> clonesCode <> "    " <> accCode <> "\\n})), ..Default::default() })")
                                       ) (Tuple (missingCount - 1) innerCall) etaArgs of`;

const newEta = `                                     etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate missingCount unit)
                                     evalArgs = Array.mapWithIndex (\\i _ -> "eval_arg_" <> show i) argsCodeArray
                                     letArgsCode = Array.mapWithIndex (\\i argCode -> "        let mut eval_arg_" <> show i <> " = " <> argCode <> ";\\n") argsCodeArray
                                     
                                     expectedArgTys = extractAllArgTypes fnTy
                                     missingEtasTypes = Array.drop m expectedArgTys
                                     retTy = fromMaybe Any (Array.last expectedArgTys)

                                     innerArgs = evalArgs <> Array.mapWithIndex (\\i eta -> boxUnbox (fromMaybe Any (Array.index missingEtasTypes i)) Any (eta <> ".clone()")) etaArgs
                                     innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                                     boxedInnerCall = boxUnbox Any retTy innerCall

                                     closuresCode = case Array.foldr (\\etaArg (Tuple i accCode) ->
                                         let prevEtas = Array.take i etaArgs
                                             clonesCode = String.joinWith "" (map (\\arg -> "    let mut " <> arg <> " = " <> arg <> ".clone();\\n") (evalArgs <> prevEtas))
                                         in Tuple (i - 1) ("perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut " <> etaArg <> ": UnknownType| -> UnknownType {\\n" <> clonesCode <> "    " <> accCode <> "\\n})), ..Default::default() })")
                                       ) (Tuple (missingCount - 1) boxedInnerCall) etaArgs of`;

code = code.replace(oldEta, newEta);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
