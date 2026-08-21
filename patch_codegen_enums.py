import sys

with open('src/Purust/CodeGen.purs', 'r') as f:
    content = f.read()

old_enums = """    -- Traduction des Enums (ADTs)
    enumsCode = String.joinWith "\\n" $ map (\\(Tuple (ProperName typeName) (meta :: DataTypeMeta)) ->
      let 
        enumName = sanitizeIdent typeName
        ctors = map (\\(Tuple (Ident ctorName) (ctorMeta :: CtorMeta)) ->
          let ctorNameClean = sanitizeIdent ctorName
              fields = map (\\_ -> "crate::UnknownType") ctorMeta.fields
          in "    " <> ctorNameClean <> if Array.length fields > 0 then "(" <> String.joinWith ", " fields <> ")" else ""
        ) (Map.toUnfoldable meta.constructors :: Array (Tuple Ident CtorMeta))
      in
        "#[derive(Clone)]\\npub enum " <> enumName <> " {\\n" <> String.joinWith ",\\n" ctors <> "\\n}\\n"
    ) (Map.toUnfoldable backendMod.dataTypes :: Array (Tuple ProperName DataTypeMeta))"""

new_enums = """    -- Traduction des Enums (ADTs)
    enumsCode = String.joinWith "\\n" $ map (\\decl ->
      let 
        enumName = sanitizeIdent decl.name
        ctors = map (\\ctor ->
          let ctorNameClean = sanitizeIdent ctor.name
              fields = map (\\fieldTy -> codegenExprType modNameStr false fieldTy) ctor.fields
          in "    " <> ctorNameClean <> if Array.length fields > 0 then "(" <> String.joinWith ", " fields <> ")" else ""
        ) decl.constructors
      in
        "#[derive(Clone)]\\npub enum " <> enumName <> " {\\n" <> String.joinWith ",\\n" ctors <> "\\n}\\n"
    ) coreFnMod.dataDecls"""

if old_enums in content:
    content = content.replace(old_enums, new_enums)
else:
    print("Could not find old_enums")
    sys.exit(1)

with open('src/Purust/CodeGen.purs', 'w') as f:
    f.write(content)
