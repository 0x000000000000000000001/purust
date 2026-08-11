const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const regex = /          Just \{ head: p, tail: rest \} ->\n              let pCode = \(if p == "_" then "" else "mut "\) <> p <> ": UnknownType"\n              \n              freeInRest = Set\.difference bodyVars \(Set\.fromFoldable rest\)/;
const replacement = `          Just { head: p, tail: rest } ->
              let 
                pCode = (if p == "_" then "" else "mut ") <> p <> ": UnknownType"
                freeInRest = Set.difference bodyVars (Set.fromFoldable rest)`;

if (!code.match(regex)) {
    console.error("Could not find indent regex!");
    process.exit(1);
}

code = code.replace(regex, replacement);

const regex2 = /                freeInRest = Set\.difference bodyVars \(Set\.fromFoldable rest\)\n              captured = Array\.filter \(\\v -> not \(Map\.member v aritiesMap\) && not \(Set\.member v allZeroArity\) && v \/= p && Set\.member v freeInRest\) \(Array\.fromFoldable freeInRest\)\n              \n              clonesCode = String\.joinWith "" \(map \(\\v -> "    let mut " <> v <> " = " <> v <> "\.clone\(\);\\n"\) captured\)\n              dropsCode = if Array\.length rest == 0 then \n                            String\.joinWith "" \(map \(\\px -> if px \/= "_" && not \(Set\.member px bodyVars\) then "    " <> px <> "\.drop_explicit\(\);\\n" else ""\) paramsArr\)\n                          else ""\n              \n              innerCode = generateNested rest\n          in "perceus_ptr::PerceusPtr::new\(Record_a \{ call: Some\(std::rc::Rc::new\(move \|" <> pCode <> "\| -> UnknownType \{\\n" <>/;

const replacement2 = `                freeInRest = Set.difference bodyVars (Set.fromFoldable rest)
                captured = Array.filter (\\v -> not (Map.member v aritiesMap) && not (Set.member v allZeroArity) && v /= p && Set.member v freeInRest) (Array.fromFoldable freeInRest)
                clonesCode = String.joinWith "" (map (\\v -> "    let mut " <> v <> " = " <> v <> ".clone();\\n") captured)
                dropsCode = if Array.length rest == 0 then 
                              String.joinWith "" (map (\\px -> if px /= "_" && not (Set.member px bodyVars) then "    " <> px <> ".drop_explicit();\\n" else "") paramsArr)
                            else ""
                innerCode = generateNested rest
              in "perceus_ptr::PerceusPtr::new(Record_a { call: Some(std::rc::Rc::new(move |" <> pCode <> "| -> UnknownType {\\n" <>`;

if (!code.match(regex2)) {
    console.error("Could not find indent regex 2!");
    process.exit(1);
}

code = code.replace(regex2, replacement2);
fs.writeFileSync('src/Purust/CodeGen.purs', code);
console.log("Fixed indentation!");
