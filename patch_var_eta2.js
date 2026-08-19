import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldEta = `               let etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate expectedArgsLength unit)
                   expectedArgTys = extractAllArgTypes fnTy
                   retTy = fromMaybe Any (Array.last expectedArgTys)
                   innerArgs = Array.mapWithIndex (\\i eta -> boxUnbox (fromMaybe Any (Array.index expectedArgTys i)) Any (eta <> ".clone()")) etaArgs
                   innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                   boxedInnerCall = boxUnbox Any retTy innerCall
               in (case Array.foldr (\\etaArg (Tuple i code) -> 
                   let prevEtas = Array.take i etaArgs
                       clonesCode = String.joinWith " " (map (\\prev -> "let mut " <> prev <> " = " <> prev <> ".clone();") prevEtas)
                   in Tuple (i - 1) ("perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut " <> etaArg <> ": UnknownType| -> UnknownType { " <> clonesCode <> " " <> code <> " })), ..Default::default() })")
                 ) (Tuple (expectedArgsLength - 1) innerCall) etaArgs of`;

const newEta = `               let etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate expectedArgsLength unit)
                   fnTy = fromMaybe Any (Map.lookup fullName aritiesMap)
                   expectedArgTys = extractAllArgTypes fnTy
                   retTy = fromMaybe Any (Array.last expectedArgTys)
                   innerArgs = Array.mapWithIndex (\\i eta -> boxUnbox (fromMaybe Any (Array.index expectedArgTys i)) Any (eta <> ".clone()")) etaArgs
                   innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                   boxedInnerCall = boxUnbox Any retTy innerCall
               in (case Array.foldr (\\etaArg (Tuple i code) -> 
                   let prevEtas = Array.take i etaArgs
                       clonesCode = String.joinWith " " (map (\\prev -> "let mut " <> prev <> " = " <> prev <> ".clone();") prevEtas)
                   in Tuple (i - 1) ("perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |mut " <> etaArg <> ": UnknownType| -> UnknownType { " <> clonesCode <> " " <> code <> " })), ..Default::default() })")
                 ) (Tuple (expectedArgsLength - 1) boxedInnerCall) etaArgs of`;

code = code.replace(oldEta, newEta);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
