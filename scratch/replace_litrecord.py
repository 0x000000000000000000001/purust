import re

with open("src/Purust/CodeGen.purs", "r") as f:
    content = f.read()

# Replace LitRecord section
pattern = r"""    LitRecord props ->
      let arrProps = props
          fields = String\.joinWith ", " \(Array\.mapWithIndex \(\\i \(Prop k v\) -> 
            let subsequent = Array\.drop \(i \+ 1\) arrProps
                aliveForV = Set\.union alive \(Array\.foldl Set\.union Set\.empty \(map \(\\\(Prop _ sv\) -> freeVariables sv\) subsequent\)\)
                vCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap globalClassFields bound aliveForV false v
                vTy = inferTypeExprGlobal currentMod aritiesMap globalClassFields bound v
                vFinal = boxUnbox currentMod Any vTy vCode
            in sanitizeIdent k <> ": Some\(" <> vFinal <> "\)"
          \) arrProps\)
      in "crate::Value::Record\(perceus_ptr::PerceusPtr::new\(Record_a \{ " <> fields <> \(if Array\.length props > 0 then ", " else ""\) <> "\.\.Default::default\(\) \}\)\)""""

replacement = """    LitRecord props ->
      let arrProps = Array.sortBy (\\(Prop k1 _) (Prop k2 _) -> compare k1 k2) props
          shape = String.joinWith "," (map (\\(Prop k _) -> k) arrProps)
          shapeName = shapeToName shape
          fields = String.joinWith ", " (Array.mapWithIndex (\\i (Prop k v) -> 
            let subsequent = Array.drop (i + 1) arrProps
                aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\\(Prop _ sv) -> freeVariables sv) subsequent))
                vCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap globalClassFields bound aliveForV false v
                vTy = inferTypeExprGlobal currentMod aritiesMap globalClassFields bound v
                vFinal = boxUnbox currentMod Any vTy vCode
            in sanitizeIdent k <> ": " <> vFinal
          ) arrProps)
      in "crate::Value::Record_" <> shapeName <> "(perceus_ptr::PerceusPtr::new(crate::Record_" <> shapeName <> " { " <> fields <> " }))\"" """

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
    with open("src/Purust/CodeGen.purs", "w") as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Pattern not found!")
