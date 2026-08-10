const fs = require('fs');
let code = fs.readFileSync('bin/purust.js', 'utf8');

const match = code.match(/const innerExpr = v\._2\.tag === "Typed" \? v\._2\._2 \: v\._2;/);
if (match) {
    console.log("Found innerExpr logic!");
} else {
    console.log("Not found.");
}
