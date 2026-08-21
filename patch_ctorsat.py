import re
import sys

with open('src/Purust/CodeGen.purs', 'r') as f:
    content = f.read()

# Replace CtorSaturated Nothing -> branch
# We will use regex to find the Nothing -> branch of CtorSaturated and replace it.
# Wait, it's easier to just replace the whole CtorSaturated block or match the specific Nothing branch.
old_nothing = """      Nothing ->
        let fieldsCode = if Array.null fields then "None" else 
              "Some(std::rc::Rc::new(vec![" <> String.joinWith ", " (Array.mapWithIndex (\\i (Tuple _ val) -> 
                let subsequent = Array.drop (i + 1) fields
                    aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\\(Tuple _ sv) -> freeVariables sv) subsequent))
                    valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap globalClassFields bound aliveForV false val
                    valTy = inferTypeExpr currentMod aritiesMap bound val
                in boxUnbox currentMod Any valTy valCode
              ) fields) <> "]))"
            boundVars = Map.toUnfoldable bound :: Array (Tuple String ExprType)
            fieldsAlive = Array.foldl Set.union Set.empty (map (\\(Tuple _ sv) -> freeVariables sv) fields)
            capturedVars = unsafePerformEffect (Ref.read globalCaptured)
            deadAdtVars = [] -- DISABLED memory reuse to avoid Rust move semantics errors
            
            reuseCode = unsafePerformEffect do
              consumed <- Ref.read globalConsumed
              let dbg = Array.foldl (\\acc (Tuple n t) -> acc <> " " <> n <> ":" <> printType t) "" boundVars
              let dbgDead = Array.foldl (\\acc (Tuple n t) -> acc <> " " <> n) "" deadAdtVars
              let available = Array.filter (\\(Tuple name _) -> not (Set.member name consumed)) deadAdtVars
              case Array.head available of
                Just (Tuple reuseName _) -> do
                  Ref.write (Set.insert reuseName consumed) globalConsumed
                  pure $ Debug.trace ("KnotTying YES ctorName=" <> ctorName <> " bound: " <> dbg <> " dead: " <> dbgDead <> " alive: " <> show (Array.fromFoldable alive :: Array String)) \\_ -> "{\\n" <>
                         "    let mut _reuse = " <> reuseName <> ";\\n" <>
                         "    {\\n" <>
                         "        let _mut = perceus_ptr::PerceusPtr::make_mut(_reuse.as_record_mut());\\n" <>
                         "        _mut.tag = \\"" <> ctorName <> "\\";\\n" <>
                         "        _mut.vals = " <> fieldsCode <> ";\\n" <>
                         "    }\\n" <>
                         "    _reuse\\n" <>
                         "}"
                Nothing ->
                  pure $ Debug.trace ("KnotTying NO ctorName=" <> ctorName <> " bound: " <> dbg <> " dead: " <> dbgDead <> " alive: " <> show (Array.fromFoldable alive :: Array String)) \\_ -> "crate::Value::Record(perceus_ptr::PerceusPtr::new(Record_a { tag: \\"" <> ctorName <> "\\", vals: " <> fieldsCode <> ", ..Default::default() }))"
        in reuseCode"""

new_nothing = """      Nothing ->
        let
           enumPrefix = case mbMod of
             Just (ModuleName mn) -> 
                let mnStr = String.replaceAll (Pattern ".") (Replacement "_") mn
                in if mnStr == currentMod then "crate::" else "Purs_" <> mnStr <> "::"
             Nothing -> "crate::"
           enumName = sanitizeIdent tyNameStr
           ctorClean = sanitizeIdent ctorName
           
           fieldsCode = if Array.null fields then "" else 
               "(" <> String.joinWith ", " (Array.mapWithIndex (\\i (Tuple _ val) -> 
                 let subsequent = Array.drop (i + 1) fields
                     aliveForV = Set.union alive (Array.foldl Set.union Set.empty (map (\\(Tuple _ sv) -> freeVariables sv) subsequent))
                     valCode = codegenExpr_ currentMod allZeroArity allMacroBindings Nothing aritiesMap globalClassFields bound aliveForV false val
                     valTy = inferTypeExpr currentMod aritiesMap bound val
                     ctorFqn = (case mbMod of
                       Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
                       Nothing -> String.replaceAll (Pattern ".") (Replacement "_") currentMod <> "_") <> ctorName
                     expectedFieldTy = case Map.lookup ctorFqn aritiesMap of
                       Just ctorTy -> fromMaybe Any (Array.index (extractAllArgTypes ctorTy) i)
                       Nothing -> Any
                 in boxUnbox currentMod expectedFieldTy valTy valCode
               ) fields) <> ")"
        in enumPrefix <> enumName <> "::" <> ctorClean <> fieldsCode"""

if old_nothing in content:
    content = content.replace(old_nothing, new_nothing)
else:
    print("Could not find old_nothing")
    sys.exit(1)

# Now CtorDef
old_ctordef = '  CtorDef _ _ (Ident ctorName) _ -> "crate::Value::Record(perceus_ptr::PerceusPtr::new(Record_a { tag: \\"" <> ctorName <> "\\", ..Default::default() }))"'
new_ctordef = '  CtorDef _ (ProperName tyNameStr) (Ident ctorName) _ -> "crate::" <> sanitizeIdent tyNameStr <> "::" <> sanitizeIdent ctorName'

if old_ctordef in content:
    content = content.replace(old_ctordef, new_ctordef)
else:
    print("Could not find old_ctordef")
    sys.exit(1)

with open('src/Purust/CodeGen.purs', 'w') as f:
    f.write(content)
