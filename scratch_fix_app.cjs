const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

code = code.replace(
    /    in if isTopLevelFn then[\s\S]*?\(\\" \<\> argCode \<\> "\\"\)"\) fnCode argsCodeArray/,
    `    in if isTopLevelFn then
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
         else fnCode <> "(" <> argsCode <> ")"
       else 
         Array.foldl (\\acc argCode -> "(" <> acc <> ").call.clone().unwrap()(" <> argCode <> ")") fnCode argsCodeArray`
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("App fixed in CodeGen.purs");
