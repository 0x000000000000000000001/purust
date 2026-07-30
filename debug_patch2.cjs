const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/retCode: if identName == "Test_Assert_assertEqual" then unsafeCrashWith \("retType is: " <> show retType\) else codegenExprType true retType/m, 'retCode: if identName == "Test_Assert_assertEqual" then unsafeCrashWith "IT REACHED HERE" else codegenExprType true retType');

fs.writeFileSync(file, code);
