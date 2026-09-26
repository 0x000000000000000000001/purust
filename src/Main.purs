module Main where

import Prelude
import Effect (Effect)
import Effect.Console (log)
import Effect.Aff (Aff, launchAff_)
import Node.FS.Sync as FS
import Node.Encoding (Encoding(..))
import Node.Process as Process
import Data.Array as Array
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Set as Set
import Data.Newtype (unwrap)
import PureScript.Backend.Optimizer.Builder (buildModules)
import PureScript.Backend.Optimizer.Directives.Defaults (defaultDirectives)
import PureScript.Backend.Optimizer.Semantics.Foreign (coreForeignSemantics)
import PureScript.Backend.Optimizer.App (coreFnModulesFromOutput, checkCache, writeCache, loadDirectives)
import Purust.CodeGen (codegenModuleWithOptions, codegenPreludeWithRenames, fieldRenames, sanitizeIdent, getArity, extractAllArgTypes, extractFinalRetType, codegenExprTypeWithValueEnums)
import Purust.BackendDeps (backendModuleDeps)
import Purust.ModuleValues (eligibleValues)
import Purust.Metrics as Metrics
import Purust.DataLayout (opaqueForeignTypeKey, valueEnumsForModules)
import Purust.ClassFields (superclassFields)
import Purust.Monomorphization (buildGlobalTypes, monomorphizeModules)
import Purust.Threading (threadedRust, threadedPrelude)
import Purust.Runtime (writeRuntime, runtimeDependency, microtasksSource)
import Purust.FfiCargo (loadFfiCargo)
import Purust.ForeignTypes (foreignTypeForwards, foreignUnboundTypes)
import Purust.ASTCollector as Purust.ASTCollector
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Ident(..), ExprType(..), Ann(..), ModuleName(..), Import(..))
import Data.Map as Map
import Data.List as List
import Data.Set as Set
import Data.Array as Array
import Data.String as String
import Data.String.CodeUnits as SCU
import Data.Foldable (foldl)
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..))
import Data.String.Pattern (Pattern(..), Replacement(..))
import Debug as Debug
import PureScript.Backend.Optimizer.FfiSupport (findFfiFile)
import Effect.Console as Console
import Effect.Class (liftEffect)
import Effect.Ref as Ref

cacheVersion :: String
cacheVersion = "1.0.0"

type GeneratedModule = { code :: String, imports :: Array String, cargo :: String }

main :: Effect Unit
main = launchAff_ $ Metrics.measure "backend total" \_ -> do
  args <- liftEffect Process.argv
  let threaded = Array.elem "--threaded" args
  let monomorphize = Array.elem "--monomorphize" args
  let tracePhases = Array.elem "--trace-phases" args
  let ffiDir = case Array.findIndex (_ == "--ffi-dir") args of
        Just idx -> Array.index args (idx + 1)
        Nothing -> Just "../"
  let mainModule = case Array.findIndex (_ == "--main") args of
                     Just idx -> case Array.index args (idx + 1) of
                                   Just m -> m
                                   Nothing -> "Main"
                     Nothing -> "Main"
  liftEffect $ log $ "Generating Rust code for " <> mainModule
  
  let sourceDir = case Array.findIndex (_ == "--source") args of
                     Just idx -> case Array.index args (idx + 1) of
                                   Just s -> s
                                   Nothing -> "output"
                     Nothing -> "output"
  loadedModules <- Metrics.measure "load TAST + sort" \_ -> coreFnModulesFromOutput sourceDir
  let finalModules = if monomorphize
        then monomorphizeModules (buildGlobalTypes (Array.fromFoldable loadedModules)) loadedModules
        else loadedModules

  -- Field spellings are resolved once for the whole compilation: record rows
  -- and class dictionaries must agree everywhere, including purust_core.
  let shapeOccurrences = Array.concatMap (\mod -> Purust.ASTCollector.collectRecordShapesModule mod)
        (List.toUnfoldable finalModules :: Array (Module Ann))
  let allShapes = chooseRecordShapes shapeOccurrences
  let shapeLabels = Set.fromFoldable (Array.filter (not <<< String.null)
        (Array.concatMap (\shape -> String.split (Pattern ",") shape) allShapes))
  let classLabels = foldl (\acc (Module mod) -> foldl (\a classDecl ->
        Set.union a (Set.fromFoldable (map (\(Tuple n _) -> n)
          (Array.concat [ superclassFields classDecl, classDecl.methods ])))) acc mod.classDecls) Set.empty finalModules
  let fieldRenameMap = fieldRenames (Set.union shapeLabels classLabels)
  
  let
    buildGlobalArities :: List.List (Module Ann) -> Map.Map String ExprType
    buildGlobalArities modules = foldl processModule Map.empty modules
      where
      processModule acc (Module mod) =
        let 
          modPrefix = String.replaceAll (Pattern ".") (Replacement "_") (unwrap mod.name) <> "_"
          
          getTy (Ann ann) = ann.type
          
          extractAnn = case _ of
            ExprVar ann _ -> ann
            ExprLit ann _ -> ann
            ExprAbs ann _ _ -> ann
            ExprApp ann _ _ -> ann
            ExprTypeApp ann _ _ -> ann
            ExprLet ann _ _ -> ann
            ExprCase ann _ _ -> ann
            ExprConstructor ann _ _ _ -> ann
            ExprAccessor ann _ _ -> ann
            ExprUpdate ann _ _ -> ann

          processBind a = case _ of
            NonRec (Binding ann (Ident name) val) ->
              let tyMb = case getTy ann of
                           Just t -> Just t
                           Nothing -> getTy (extractAnn val)
              in case tyMb of
                Just ty -> Map.insert (modPrefix <> sanitizeIdent name) ty a
                Nothing -> a
            Rec binds ->
              foldl (\a' (Binding ann (Ident name) val) ->
                let tyMb = case getTy ann of
                             Just t -> Just t
                             Nothing -> getTy (extractAnn val)
                in case tyMb of
                  Just ty -> Map.insert (modPrefix <> sanitizeIdent name) ty a'
                  Nothing -> a'
              ) a binds

          acc1 = foldl processBind acc mod.decls
          
          acc2 = foldl (\a (Tuple (Ident name) mbTy) -> 
              case mbTy of
                Just ty -> Map.insert (modPrefix <> sanitizeIdent name) ty a
                Nothing -> a
            ) acc1 (Map.toUnfoldable mod.foreign :: Array (Tuple Ident (Maybe ExprType)))
            
          acc3 = foldl (\a decl -> 
              foldl (\a2 ctor -> 
                let modPath = String.split (Pattern ".") (unwrap mod.name)
                    fqn = Array.snoc modPath decl.name
                    retTy = ADT decl.name fqn []
                    ty = if Array.length ctor.fields > 0 then Func ctor.fields retTy else retTy
                in Map.insert (modPrefix <> sanitizeIdent ctor.name) ty a2
              ) a decl.constructors
            ) acc2 mod.dataDecls
            
        in acc3
        
    buildGlobalTypes :: List.List (Module Ann) -> Set.Set String
    buildGlobalTypes modules = foldl processModule Set.empty modules
      where
      processModule acc (Module mod) =
        let modStr = String.replaceAll (Pattern ".") (Replacement "_") (unwrap mod.name)
            accData = foldl (\acc2 decl -> Set.insert (modStr <> "_" <> sanitizeIdent decl.name <> "_enum") acc2) acc mod.dataDecls
            accClass = foldl (\acc2 decl -> Set.insert (modStr <> "_" <> sanitizeIdent decl.name) acc2) accData mod.classDecls
        in accClass

    buildGlobalClassFields :: List.List (Module Ann) -> Map.Map String (Array (Tuple String ExprType))
    buildGlobalClassFields modules = foldl processModule Map.empty modules
      where
      processModule acc (Module mod) =
        let modPrefix = String.replaceAll (Pattern ".") (Replacement "_") (unwrap mod.name) <> "_"
        in foldl (\a classDecl -> 
             let 
               superNames = superclassFields classDecl
               methodNames = map (\(Tuple mName mTy) -> Tuple mName mTy) classDecl.methods
               allFields = Array.concat [superNames, methodNames]
             in Map.insert (modPrefix <> sanitizeIdent classDecl.name) allFields a
           ) acc mod.classDecls

  prepared <- Metrics.measure "prepare" \_ -> do
    let globalArities = buildGlobalArities finalModules
    let globalTypes = buildGlobalTypes finalModules
    let globalClassFields = buildGlobalClassFields finalModules

    -- A foreign import data type with no native Rust declaration carries
    -- arbitrary coerced values (freeap's Val). Its layout is the boxed runtime
    -- Value, so generated code must not wrap or downcast it. The declaration
    -- scan needs only the module source and its FFI file, so it runs before
    -- code generation and joins the shared layout-fact set.
    let
      gatherOpaque (Module m) = do
        let dotted = unwrap m.name
        let modName = String.replaceAll (Pattern ".") (Replacement "_") dotted
        ffiPathMb <- findFfiFile ".rs" [] ffiDir dotted (Just m.path)
        ffiContent <- case ffiPathMb of
          Just ffiPath -> do
            exists <- FS.exists ffiPath
            if exists then FS.readTextFile UTF8 ffiPath else pure ""
          Nothing -> pure ""
        sourceExists <- FS.exists m.path
        source <- if sourceExists then FS.readTextFile UTF8 m.path else pure ""
        pure $ map (opaqueForeignTypeKey modName) (foreignUnboundTypes source ffiContent)
    opaqueForeignTypes <- liftEffect do
      perModule <- traverse gatherOpaque (List.toUnfoldable finalModules :: Array (Module Ann))
      pure $ Set.fromFoldable (Array.concat perModule)
    let globalValueEnums = Set.union (valueEnumsForModules finalModules) opaqueForeignTypes

    directives <- loadDirectives

    modulesRef <- liftEffect $ Ref.new (Map.empty :: Map.Map String GeneratedModule)
    pure { globalArities, globalClassFields, globalValueEnums, directives, modulesRef }

  let { globalArities, globalClassFields, globalValueEnums, directives, modulesRef } = prepared

  Metrics.measure "optimize + generate" \_ -> buildModules
    { directives
    , rewriteLimit: 10000
    , analyzeCustom: \_ _ -> Nothing
    , foreignSemantics: coreForeignSemantics
    , traceIdents: Set.empty
    , onPrepareModule: \_ (Module m) -> do
        when tracePhases $ liftEffect $ log ("[purust] optimize " <> unwrap m.name)
        pure (Module m)
    , onSkipModule: \_ (Module coreFnMod) -> do
        pure Nothing
    , onCodegenModule: \_ (Module coreFnMod) backendMod _ -> do
        let modNameStr = unwrap backendMod.name
        when tracePhases $ liftEffect $ log ("[purust] codegen " <> modNameStr)
        let rsFile = codegenModuleWithOptions { threaded, moduleValues: eligibleValues (Module coreFnMod), fieldRenames: fieldRenameMap } globalValueEnums globalArities globalClassFields (Module coreFnMod) backendMod
        
        liftEffect do
          when tracePhases $ log ("[purust] generated " <> modNameStr)
          let foreignArr = coreFnMod.foreign
          let modName = String.replaceAll (Pattern ".") (Replacement "_") (unwrap coreFnMod.name)
          let modPrefix = modName <> "_"
          let allMacroBindings = Set.empty -- Placeholder
          
          ffiPathMb <- findFfiFile ".rs" [] ffiDir modNameStr (Just coreFnMod.path)
          cargo <- case ffiPathMb of
            Just ffiPath -> loadFfiCargo ffiPath
            Nothing -> pure ""
          let
            getArity (ForAll _ t) = getArity t
            getArity (ConstrainedType _ t) = getArity t
            getArity (Func args t) = Array.length args + getArity t
            getArity _ = 0
            
            genFallback name ty =
              if not (Set.member (modPrefix <> sanitizeIdent (unwrap name)) allMacroBindings) then
                let argTypes = extractAllArgTypes ty
                    args = Array.mapWithIndex (\i argTy -> "mut a" <> show i <> ": " <> codegenExprTypeWithValueEnums globalValueEnums modName true argTy) argTypes
                    retTyStr = codegenExprTypeWithValueEnums globalValueEnums modName true (extractFinalRetType ty)
                    defaultRet = case retTyStr of
                          "i64" -> "0"
                          "f64" -> "0.0"
                          "bool" -> "false"
                          "char" -> "'\\0'"
                          "String" -> "String::new()"
                          _ -> "unimplemented!()"
                in "pub fn " <> modPrefix <> sanitizeIdent (unwrap name) <> "(" <> String.joinWith ", " args <> ") -> " <> retTyStr <> " { " <> defaultRet <> " }\n"
              else ""

          ffiContent <- case ffiPathMb of
            Just ffiPath -> do
              content <- FS.readTextFile UTF8 ffiPath
              let missingStubs = Array.foldMap (\tup -> case tup of
                    Tuple name (Just ty) ->
                      if String.contains (Pattern ("fn " <> modPrefix <> sanitizeIdent (unwrap name))) content then
                        ""
                      else
                        genFallback name ty
                    Tuple _ Nothing -> ""
                  ) (Map.toUnfoldable foreignArr)
              pure $ content <> "\n\n" <> missingStubs
            Nothing -> pure $ Array.foldMap (\tup -> case tup of
                Tuple name (Just ty) -> genFallback name ty
                Tuple _ Nothing -> ""
              ) (Map.toUnfoldable foreignArr)
          
          sourceExists <- FS.exists coreFnMod.path
          opaqueTypes <- if sourceExists then do
            source <- FS.readTextFile UTF8 coreFnMod.path
            pure $ foreignTypeForwards source (rsFile <> "\n" <> ffiContent)
            else pure ""
          -- Dependencies come from the optimized backend module plus the
          -- emitted text, not from the pre-codegen AST: optimisation removes
          -- references, and a spurious edge can make the crate graph cyclic.
          let rawModules = Set.toUnfoldable (backendModuleDeps globalValueEnums backendMod) :: Array String
          let extractModules s = Array.mapMaybe (\part -> 
                case String.indexOf (Pattern "::") part of
                  Just i -> 
                    let mod = String.take i part
                        isValid c = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_'
                    in if String.length mod > 0 && String.length mod < 100 && Array.all isValid (SCU.toCharArray mod) then Just mod else Nothing
                  Nothing -> Nothing
              ) (Array.drop 1 (String.split (Pattern "Purs_") s))
          let extractedModules = extractModules (rsFile <> "\n" <> ffiContent)
          let allModules = Array.concat [rawModules, extractedModules]
          
          let coreImports = Array.nub (Array.mapMaybe (\n -> 
                let nStr = String.replaceAll (Pattern ".") (Replacement "_") n
                    isSelf = nStr == modName
                in if n == "Prim" || String.indexOf (Pattern "Prim.") n == Just 0 || isSelf then Nothing else Just nStr
              ) allModules)
          let importsRust = String.joinWith "\n" (map (\i -> "use Purs_" <> i <> "::*;") coreImports)
          let rustCode = "#![allow(warnings)]\n#![recursion_limit = \"512\"]\nuse perceus_ptr::PerceusPtr;\nuse purust_core::*;\n" <> importsRust <> "\n\n" <> rsFile <> "\n\n" <> ffiContent <> "\n\n" <> opaqueTypes
          Ref.modify_ (\acc -> Map.insert modName { code: rustCode, imports: coreImports, cargo } acc) modulesRef
    }
    finalModules
    
  Metrics.measure "finalize + emit" \_ -> liftEffect do
    let outDir = case Array.findIndex (_ == "--out") args of
                     Just idx -> case Array.index args (idx + 1) of
                                   Just o -> o
                                   Nothing -> "output/purust_output"
                     Nothing -> "output/purust_output"
    srcExists <- FS.exists (outDir <> "/src")
    when (not srcExists) do
      FS.mkdir outDir
      FS.mkdir (outDir <> "/src")
    writeRuntime outDir
    
    
    allModules <- Ref.read modulesRef
    
    -- Transitive closure of imports
    tcRef <- Ref.new (Map.empty :: Map.Map String (Set.Set String))
    let initTc = Map.toUnfoldable allModules :: Array (Tuple String GeneratedModule)
    _ <- foldl (\eff (Tuple k v) -> eff *> Ref.modify_ (Map.insert k (Set.fromFoldable v.imports)) tcRef) (pure unit) initTc
    
    let loop = do
          changed <- Ref.new false
          currMap <- Ref.read tcRef
          let arr = Map.toUnfoldable currMap :: Array (Tuple String (Set.Set String))
          _ <- foldl (\eff (Tuple k imps) -> eff *> do
            let newImps = foldl (\acc i -> 
                  case Map.lookup i currMap of
                    Just trans -> Set.union acc trans
                    Nothing -> acc
                ) imps (Set.toUnfoldable imps :: Array String)
            if Set.size newImps > Set.size imps then do
               Ref.write true changed
               Ref.modify_ (Map.insert k newImps) tcRef
            else pure unit
          ) (pure unit) arr
          isChanged <- Ref.read changed
          if isChanged then loop else pure unit
    loop
    finalTcMap <- Ref.read tcRef

    
    let preludeRsContent = (if threaded then threadedPrelude else identity) (codegenPreludeWithRenames fieldRenameMap allShapes)
    
    let mainModuleSanitized = String.replaceAll (Pattern ".") (Replacement "_") mainModule
    -- AOT spec discovery: when the discovery module is part of the program,
    -- every module exporting a nullary `spec` value is registered in the
    -- generated main. The runtime pattern filter keeps the upstream contract
    -- (any module name matching the pattern), so new fixtures are picked up
    -- by rebuilding alone.
    let specModules =
          if Map.member "Test_Spec_Discovery" allModules then
            Array.mapMaybe
              (\(Module mod) ->
                let dotted = unwrap mod.name
                    key = String.replaceAll (Pattern ".") (Replacement "_") dotted
                    hasAccessor = case Map.lookup key allModules of
                      Just generated -> String.contains (Pattern ("pub fn " <> key <> "_spec()")) generated.code
                      Nothing -> false
                in if key /= "Test_Spec_Discovery"
                     && Array.elem (Ident "spec") mod.exports
                     && hasAccessor
                   then Just (Tuple dotted key)
                   else Nothing)
              (List.toUnfoldable finalModules :: Array (Module Ann))
          else []
    let registrationDeps =
          if Array.null specModules then ""
          else "Purs_Test_Spec_Discovery = { path = \"Purs_Test_Spec_Discovery\" }\n"
            <> String.joinWith "" (map (\(Tuple _ key) -> "Purs_" <> key <> " = { path = \"Purs_" <> key <> "\" }\n") specModules)
    let registrations = String.joinWith "" (map (\(Tuple dotted key) ->
          "    Purs_Test_Spec_Discovery::purust_register_spec(" <> show dotted <> ".to_string(), || purust_core::Value::Class(std::rc::Rc::new(Purs_" <> key <> "::" <> key <> "_spec())));\n"
        ) specModules)
    let workspaceMembers = "\"perceus_ptr\", \"purust_core\", " <> String.joinWith ", " (map (\(Tuple k _) -> "\"Purs_" <> k <> "\"") (Map.toUnfoldable allModules :: Array (Tuple String GeneratedModule)))
    let runsAff = threaded && Map.member "Effect_Aff" allModules
    let affDependency = if runsAff then "Purs_Effect_Aff = { path = \"Purs_Effect_Aff\" }\n" else ""
    let rootCargoToml = "[workspace]\nmembers = [\n  " <> workspaceMembers <> "\n]\n\n[package]\nname = \"purust_output\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[profile.release]\ndebug = true\nopt-level = 1\nlto = \"thin\"\n\n[dependencies]\nmimalloc = \"0.1.32\"\nPurs_" <> mainModuleSanitized <> " = { path = \"Purs_" <> mainModuleSanitized <> "\" }\npurust_core = { path = \"purust_core\" }\n" <> registrationDeps <> runtimeDependency threaded "perceus_ptr"
    FS.writeTextFile UTF8 (outDir <> "/Cargo.toml") (configureThreading threaded (rootCargoToml <> affDependency))
    
    -- `main :: Unit -> Unit` (an `Effect Unit` is opaque, but the tests of
    -- `prelude` use `Unit -> Unit` aliases) is generated as a native Rust
    -- function, while `Effect Unit` is a curried value. Pick the matching call.
    let nativeMain = case Map.lookup (mainModuleSanitized <> "_main") globalArities of
          Just (Func [ Unit ] _) -> true
          _ -> false
    let runMain = if nativeMain
          then "Purs_" <> mainModuleSanitized <> "::main(())"
          else "let _effect = Purs_" <> mainModuleSanitized <> "::main();\n    (_effect.unwrap_func1())(purust_core::Value::Unit)"
    let mainBody = if runsAff then "Purs_Effect_Aff::purust_aff_run_main(|| {\n" <> registrations <> "    " <> runMain <> " });"
          else "purust_core::microtasks::run_main(|| {\n" <> registrations <> "    " <> runMain <> " });"
    let mainEntry =
          "#[global_allocator]\nstatic GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;\n\n"
          <> "fn main() {\n"
          <> "    // Deeply recursive PureScript programs (and their drops) need more than\n"
          <> "    // the platform default; run on a thread with a large, configurable stack.\n"
          <> "    let stack_size = std::env::var(\"PURUST_STACK_SIZE\")\n"
          <> "        .ok()\n"
          <> "        .and_then(|value| value.parse::<usize>().ok())\n"
          <> "        .filter(|size| *size > 0)\n"
          <> "        .unwrap_or(1024 * 1024 * 1024);\n"
          <> "    let failed = std::thread::Builder::new()\n"
          <> "        .name(\"purust-main\".to_owned())\n"
          <> "        .stack_size(stack_size)\n"
          <> "        .spawn(move || {\n"
          <> "            purust_core::microtasks::run_program_guarded(|| {\n            " <> mainBody <> "\n            })\n"
          <> "        })\n"
          <> "        .expect(\"failed to start the program thread\")\n"
          <> "        .join()\n"
          <> "        .is_err();\n"
          <> "    if failed {\n"
          <> "        std::process::exit(101);\n"
          <> "    }\n"
          <> "    purust_core::microtasks::finish_process();\n"
          <> "}\n"
    FS.writeTextFile UTF8 (outDir <> "/src/main.rs") (if threaded then threadedRust mainEntry else mainEntry)
    
    let coreDir = outDir <> "/purust_core"
    coreExists <- FS.exists coreDir
    when (not coreExists) do
      FS.mkdir coreDir
      FS.mkdir (coreDir <> "/src")
    FS.writeTextFile UTF8 (coreDir <> "/Cargo.toml") $ configureThreading threaded ("[package]\nname = \"purust_core\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n" <> runtimeDependency threaded "../perceus_ptr" <> "fancy-regex = \"0.13\"\n")
    FS.writeTextFile UTF8 (coreDir <> "/src/lib.rs") (preludeRsContent <> "\npub mod microtasks {\n"
      <> (if threaded then threadedRust microtasksSource else microtasksSource) <> "\n}\n")
    
    _ <- foldl (\eff (Tuple k { code: v, imports: imp, cargo }) -> eff *> do
      let modDir = outDir <> "/Purs_" <> k
      modExists <- FS.exists modDir
      when (not modExists) do
        FS.mkdir modDir
        FS.mkdir (modDir <> "/src")
      -- A crate never depends on itself: specialization can introduce
      -- same-module references that the import collector reports as imports.
      -- A crate never depends on itself: specialization can introduce
      -- same-module references that the import collector reports as imports.
      -- The rest of the collected set stays untouched; glob imports make a
      -- narrower filter unsound, since symbols arrive unqualified.
      let modDepSet = Set.delete k (fromMaybe Set.empty (Map.lookup k finalTcMap))
          modDepList = Set.toUnfoldable modDepSet :: Array String
          modDeps = "purust_core = { path = \"../purust_core\" }\n" <> runtimeDependency threaded "../perceus_ptr" <> "fancy-regex = \"0.13\"\n" <> String.joinWith "\n" (map (\i -> "Purs_" <> i <> " = { path = \"../Purs_" <> i <> "\" }") modDepList)
      let modCargoToml = "[package]\nname = \"Purs_" <> k <> "\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n" <> modDeps
      FS.writeTextFile UTF8 (modDir <> "/Cargo.toml") (configureThreading threaded (modCargoToml <> (if cargo == "" then "" else "\n" <> cargo)))
      let transImps = modDepList
      let newImportsRust = String.joinWith "\n" (map (\i -> "use Purs_" <> i <> "::*;") transImps)
      let finalCode = String.replace (Pattern "use purust_core::*;\n") (Replacement ("use purust_core::*;\n" <> newImportsRust <> "\n")) v
      FS.writeTextFile UTF8 (modDir <> "/src/lib.rs") ((if threaded then threadedRust else identity) finalCode)
    ) (pure unit) (Map.toUnfoldable allModules :: Array (Tuple String GeneratedModule))

    
    log "Successfully generated Rust code."


-- A record shape is shared by every record with the same labels, so its native
-- Rust carrier has a single field order. Preserve the order the source wrote
-- while every occurrence of a label set agrees; fall back to the canonical
-- (sorted) order when the program writes the same set in several orders.
chooseRecordShapes :: Array { literal :: Boolean, shape :: String } -> Array String
chooseRecordShapes occurrences = map choose (Array.fromFoldable (Map.values (foldl insert Map.empty occurrences)))
  where
  insert acc occurrence =
    let labels = Array.filter (not <<< String.null) (String.split (Pattern ",") occurrence.shape)
    in if Array.null labels then acc
       else
         let key = String.joinWith "," (Array.sortBy compare (Array.nub labels))
         in case Map.lookup key acc of
           Nothing -> Map.insert key
             { key
             , literals: if occurrence.literal then [ occurrence.shape ] else []
             , types: if occurrence.literal then [] else [ occurrence.shape ]
             }
             acc
           Just entry -> Map.insert key
             ( if occurrence.literal
                 then entry { literals = Array.snoc entry.literals occurrence.shape }
                 else entry { types = Array.snoc entry.types occurrence.shape }
             )
             acc

  -- Literal orders are what JavaScript enumerates, so they win over annotation
  -- orders; when either source disagrees with itself the canonical (sorted)
  -- order stays in place.
  choose entry = case Array.nub entry.literals of
    [ only ] -> only
    [] -> case Array.nub entry.types of
      [ only ] -> only
      _ -> entry.key
    _ -> entry.key


configureThreading :: Boolean -> String -> String
configureThreading false = identity
configureThreading true =
  String.replaceAll (Pattern "[dependencies]\n")
    (Replacement "[dependencies]\ntokio = { version = \"1.53.1\", features = [\"rt-multi-thread\", \"time\", \"sync\", \"macros\"] }\n")
