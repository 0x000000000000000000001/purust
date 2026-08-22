      OpIsTag (Qualified mbMod (Ident ctorName)) -> 
        let modNameForLookup = case mbMod of
              Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn
              Nothing -> currentMod
            cName = sanitizeIdent ctorName
            prefixedKey = modNameForLookup <> "_" <> cName
            lookupRes = Map.lookup prefixedKey aritiesMap
            actualAdt = case unwrapType aTy of
              ADT className fqn args -> Just { className, fqn }
              _ -> case map extractFinalRetType lookupRes of
                Just (ADT className fqn args) -> Just { className, fqn }
                _ -> Nothing
        in case actualAdt of
          Just { className, fqn } -> 
             let modName = String.replaceAll (Pattern ".") (Replacement "_") (String.joinWith "_" (Array.dropEnd 1 fqn))
                 actualClassName = fromMaybe className (Array.last fqn)
                 enumName = if modName == currentMod then "crate::" <> sanitizeIdent actualClassName else "Purs_" <> modName <> "::" <> sanitizeIdent actualClassName
                 hasArgs = case map unwrapType lookupRes of
                   Just (Func _ _) -> true
                   _ -> false
                 suffix = if hasArgs then "(..)" else ""
                 boxedA = boxUnbox currentMod (ADT className fqn []) aTy aStrRaw
                 debugComment = "/* OpIsTag Debug: " <> prefixedKey <> " -> " <> (case lookupRes of
                   Just t -> printType t
                   Nothing -> "Nothing") <> " */ "
             in debugComment <> "matches!((" <> boxedA <> ").as_ref(), " <> enumName <> "::" <> cName <> suffix <> ")"
          Nothing -> "(" <> boxUnbox currentMod Any aTy aStrRaw <> ".unwrap_record().tag == \"" <> ctorName <> "\")"
