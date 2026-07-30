const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'Purust', 'CodeGen.purs');
let code = fs.readFileSync(file, 'utf8');

// Replace codegenExprType
const newType = `codegenExprType :: Boolean -> ExprType -> String
codegenExprType isRet = case _ of
  Func args ret -> "std::rc::Rc<dyn Fn(" <> String.joinWith ", " (map (codegenExprType false) args) <> ") -> " <> codegenExprType true ret <> ">"
  Any -> "UnknownType"
  Record _ -> "UnknownType"
  Array _ -> "UnknownType"
  Tuple _ _ -> "UnknownType"
  String -> "String"
  Int -> "i64"
  Number -> "f64"
  Boolean -> "bool"
  Char -> "char"
  ADT _ (Qualified _ (Ident "String")) -> "String"
  ADT _ (Qualified _ (Ident "Int")) -> "i64"
  ADT _ (Qualified _ (Ident "Boolean")) -> "bool"
  ADT _ _ -> "UnknownType"
  TypeVar _ -> "UnknownType"
  TypeApp _ _ -> "UnknownType"`;

code = code.replace(/codegenExprType :: Boolean -> ExprType -> String\ncodegenExprType _ _ = "UnknownType"/m, newType);

fs.writeFileSync(file, code);
