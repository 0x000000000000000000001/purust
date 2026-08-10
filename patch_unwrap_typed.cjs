const fs = require('fs');
let code = fs.readFileSync('src/Purust/CodeGen.purs', 'utf8');

const unwrapFn = `
unwrapTyped :: NeutralExpr -> NeutralExpr
unwrapTyped (NeutralExpr (Typed _ inner)) = unwrapTyped inner
unwrapTyped e = e
`;

if (!code.includes('unwrapTyped ::')) {
    code = code.replace('codegenExprType ::', unwrapFn + '\ncodegenExprType ::');
}

code = code.replace(
    /innerExpr = case expr of\s+NeutralExpr \(Typed _ inner\) -> inner\s+NeutralExpr inner -> NeutralExpr inner\s+_ -> expr/g,
    'innerExpr = unwrapTyped expr'
);

fs.writeFileSync('src/Purust/CodeGen.purs', code);
