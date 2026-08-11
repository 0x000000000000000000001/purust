const fs = require('fs');
let content = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');
if (content.includes("Set.difference (Set.union allValsVars (freeVariables body)) bindsVars")) {
    console.log("LetRec freeVars logic IS correct in CodeGen.purs");
} else {
    console.log("LetRec freeVars logic is NOT in CodeGen.purs!!!");
}
