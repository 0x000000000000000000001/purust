import fs from 'fs';
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const oldEta = `               let etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate expectedArgsLength unit)
                   innerArgs = map (\\eta -> eta <> ".clone()") etaArgs
                   innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
               in (case Array.foldr (\\etaArg (Tuple i code) -> `;

const newEta = `               let etaArgs = Array.mapWithIndex (\\i _ -> "eta_" <> show i) (Array.replicate expectedArgsLength unit)
                   expectedArgTys = extractAllArgTypes fnTy
                   retTy = fromMaybe Any (Array.last expectedArgTys)
                   innerArgs = Array.mapWithIndex (\\i eta -> boxUnbox (fromMaybe Any (Array.index expectedArgTys i)) Any (eta <> ".clone()")) etaArgs
                   innerCall = fullName <> "(" <> String.joinWith ", " innerArgs <> ")"
                   boxedInnerCall = boxUnbox Any retTy innerCall
               in (case Array.foldr (\\etaArg (Tuple i code) -> `;

code = code.replace(oldEta, newEta);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
