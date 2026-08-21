import re

with open('src/Purust/CodeGen.purs', 'r') as f:
    content = f.read()

# Replace boxUnbox signature
content = content.replace('boxUnbox :: ExprType -> ExprType -> String -> String', 'boxUnbox :: String -> ExprType -> ExprType -> String -> String')
content = content.replace('boxUnbox expected actual code =', 'boxUnbox currentMod expected actual code =')
content = re.sub(r'boxUnbox (\w+)', r'boxUnbox currentMod \1', content)
# Fix the double currentMod if it happened
content = content.replace('boxUnbox currentMod currentMod', 'boxUnbox currentMod')

# Fix boxUnbox Any (which might have been caught by \w+)
content = content.replace('boxUnbox currentMod Any', 'boxUnbox currentMod Any')

# Replace codegenExprType signature
content = content.replace('codegenExprType :: Boolean -> ExprType -> String', 'codegenExprType :: String -> Boolean -> ExprType -> String')
content = content.replace('codegenExprType isRet ty =', 'codegenExprType currentMod isRet ty =')
content = re.sub(r'codegenExprType (true|false)', r'codegenExprType currentMod \1', content)

# Fix in codegenModule where it should be modNameStr instead of currentMod
content = content.replace('codegenExprType currentMod false mTy', 'codegenExprType modNameStr false mTy')

# Now add ADT to codegenExprType
adt_case = """  Char -> "char"
  ADT className fqn _ -> 
    let modName = String.joinWith "_" (Array.dropEnd 1 fqn)
    in if modName == currentMod then "crate::" <> sanitizeIdent className else "Purs_" <> modName <> "::" <> sanitizeIdent className"""
content = content.replace('  Char -> "char"', adt_case)

with open('src/Purust/CodeGen.purs', 'w') as f:
    f.write(content)
