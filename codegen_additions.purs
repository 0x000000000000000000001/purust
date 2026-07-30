freeVariables :: NeutralExpr -> Set String
freeVariables (NeutralExpr expr) = case expr of
  Var (Qualified _ (Ident name)) -> Set.singleton name
  App fn args -> 
    Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) (NonEmptyArray.toArray args)
  Let (Just (Ident i)) _ val body ->
    Set.union (freeVariables val) (Set.delete i (freeVariables body))
  Let Nothing _ val body ->
    Set.union (freeVariables val) (freeVariables body)
  Typed _ inner -> freeVariables inner
  _ -> Set.empty

inferTypeExpr :: String -> Map.Map String ExprType -> Map.Map String ExprType -> NeutralExpr -> ExprType
inferTypeExpr currentMod aritiesMap bound (NeutralExpr expr) = case expr of
  App fn args -> 
    case inferTypeExpr currentMod aritiesMap bound fn of
      Func argTypes retTy -> 
        let expectedCount = Array.length argTypes
            providedCount = NonEmptyArray.length args
        in if expectedCount > providedCount then
             Func (Array.drop providedCount argTypes) retTy
           else retTy
      _ -> Any
  UncurriedApp fn _args -> 
    case inferTypeExpr currentMod aritiesMap bound fn of
      Func _ retTy -> retTy
      _ -> Any
  UncurriedEffectApp fn args -> 
    case inferTypeExpr currentMod aritiesMap bound fn of
      Func _ retTy -> retTy
      _ -> Any
  LetRec _ _ inner -> inferTypeExpr currentMod aritiesMap bound inner
  Branch _ _ -> Any
  Typed Any inner -> inferTypeExpr currentMod aritiesMap bound inner
  Typed (TypeVar _) inner -> inferTypeExpr currentMod aritiesMap bound inner
  Typed t _ -> t
  Var (Qualified mbMod (Ident name)) -> 
    let
      modPrefix = case mbMod of
        Just (ModuleName mn) -> String.replaceAll (Pattern ".") (Replacement "_") mn <> "_"
        Nothing -> ""
      fullName = modPrefix <> sanitizeIdent name
    in case Map.lookup name bound of
      Just ty -> ty
      Nothing -> case Map.lookup fullName aritiesMap of
        Just ty -> ty
        Nothing -> Any
  Let (Just (Ident i)) _ val body -> inferTypeExpr currentMod aritiesMap (Map.insert i (inferTypeExpr currentMod aritiesMap bound val) bound) body
  _ -> Any

sanitizeIdent :: String -> String
sanitizeIdent s = 
  let s1 = String.replaceAll (Pattern "'") (Replacement "_prime") s
  in if s1 == "type" then "type_kw" 
     else if s1 == "fn" then "fn_kw" 
     else s1

dedupArgs :: Array String -> Array String
dedupArgs arr =
  let
    step acc item =
      let count = Map.lookup item acc.counts
      in case count of
        Nothing ->
          { result: Array.snoc acc.result item, counts: Map.insert item 1 acc.counts }
        Just c ->
          let newItem = item <> "_" <> show c
          in { result: Array.snoc acc.result newItem, counts: Map.insert item (c + 1) acc.counts }
  in (Array.foldl step { result: [], counts: Map.empty } arr).result
