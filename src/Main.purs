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
import Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity, extractAllArgTypes, extractFinalRetType, codegenExprType)
import Purust.ASTCollector as Purust.ASTCollector
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Ident(..), ExprType(..), Ann(..), ModuleName(..), Import(..))
import Data.Map as Map
import Data.List as List
import Data.Set as Set
import Data.Array as Array
import Data.String as String
import Data.String.CodeUnits as SCU
import Data.Foldable (foldl)
import Data.Tuple (Tuple(..))
import Data.String.Pattern (Pattern(..), Replacement(..))
import Debug as Debug
import PureScript.Backend.Optimizer.FfiSupport (findFfiFile)
import Effect.Console as Console
import Effect.Class (liftEffect)
import Effect.Ref as Ref

cacheVersion :: String
cacheVersion = "1.0.0"

main :: Effect Unit
main = launchAff_ do
  args <- liftEffect Process.argv
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
  finalModules <- coreFnModulesFromOutput sourceDir
  
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
               superNames = Array.mapWithIndex (\i (Tuple fqn _) -> 
                 Tuple ((case Array.last fqn of
                    Just sc -> sc
                    Nothing -> "Super") <> show i) Any
               ) classDecl.superclasses
               methodNames = map (\(Tuple mName mTy) -> Tuple (sanitizeIdent mName) mTy) classDecl.methods
               allFields = Array.concat [superNames, methodNames]
             in Map.insert (modPrefix <> sanitizeIdent classDecl.name) allFields a
           ) acc mod.classDecls

  let globalArities = buildGlobalArities finalModules
  let globalTypes = buildGlobalTypes finalModules
  let globalClassFields = buildGlobalClassFields finalModules
  
  directives <- loadDirectives
  
  modulesRef <- liftEffect $ Ref.new (Map.empty :: Map.Map String { code :: String, imports :: Array String })
  
  buildModules
    { directives
    , rewriteLimit: 10000
    , analyzeCustom: \_ _ -> Nothing
    , foreignSemantics: coreForeignSemantics
    , traceIdents: Set.empty
    , onPrepareModule: \_ (Module m) -> pure (Module m)
    , onSkipModule: \_ (Module coreFnMod) -> do
        pure Nothing
    , onCodegenModule: \_ (Module coreFnMod) backendMod _ -> do
        let modNameStr = unwrap backendMod.name
        let rsFile = codegenModule globalArities globalClassFields (Module coreFnMod) backendMod
        
        liftEffect do
          let foreignArr = coreFnMod.foreign
          let modName = String.replaceAll (Pattern ".") (Replacement "_") (unwrap coreFnMod.name)
          let modPrefix = modName <> "_"
          let allMacroBindings = Set.empty -- Placeholder
          
          ffiPathMb <- findFfiFile ".rs" [] (Just "../") modNameStr (Just coreFnMod.path)
          let
            getArity (ForAll _ t) = getArity t
            getArity (ConstrainedType _ t) = getArity t
            getArity (Func args t) = Array.length args + getArity t
            getArity _ = 0
            
            genFallback name ty =
              if not (Set.member (modPrefix <> sanitizeIdent (unwrap name)) allMacroBindings) then
                let argTypes = extractAllArgTypes ty
                    args = Array.mapWithIndex (\i argTy -> "mut a" <> show i <> ": " <> codegenExprType modName true argTy) argTypes
                    _ = Debug.trace ("genFallback " <> unwrap name <> " args: " <> show args) \_ -> unit
                    retTyStr = codegenExprType modName true (extractFinalRetType ty)
                    defaultRet = case retTyStr of
                          "i64" -> "0"
                          "f64" -> "0.0"
                          "bool" -> "false"
                          "char" -> "'\\0'"
                          "String" -> "String::new()"
                          _ -> "unimplemented!()"
                in "pub fn " <> modPrefix <> sanitizeIdent (unwrap name) <> "(" <> String.joinWith ", " args <> ") -> " <> retTyStr <> " { " <> defaultRet <> " }\n"
              else ""

          let _ = Debug.trace ("Found FFI for " <> modNameStr <> " at: " <> show ffiPathMb) \_ -> unit
          liftEffect $ Console.log ("Found FFI for " <> modNameStr <> " at: " <> show ffiPathMb)
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
          
          let rawModules = Set.toUnfoldable (Purust.ASTCollector.collectModulesModule (Module coreFnMod)) :: Array String
          let extractModules s = Array.mapMaybe (\part -> 
                case String.indexOf (Pattern "::") part of
                  Just i -> 
                    let mod = String.take i part
                        isValid c = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_'
                    in if String.length mod > 0 && String.length mod < 100 && Array.all isValid (SCU.toCharArray mod) then Just mod else Nothing
                  Nothing -> Nothing
              ) (Array.drop 1 (String.split (Pattern "Purs_") s))
          let extractedModules = extractModules rsFile
          let allModules = Array.concat [rawModules, extractedModules]
          
          let coreImports = Array.nub (Array.mapMaybe (\n -> 
                let nStr = String.replaceAll (Pattern ".") (Replacement "_") n
                    isSelf = nStr == modName
                in if n == "Prim" || String.indexOf (Pattern "Prim.") n == Just 0 || isSelf then Nothing else Just nStr
              ) allModules)
          let importsRust = String.joinWith "\n" (map (\i -> "use Purs_" <> i <> "::*;") coreImports)
          let rustCode = "#![allow(warnings)]\nuse perceus_ptr::PerceusPtr;\nuse purust_core::*;\n" <> importsRust <> "\n\n" <> rsFile <> "\n\n" <> ffiContent <> "\n\n"
          Ref.modify_ (\acc -> Map.insert modName { code: rustCode, imports: coreImports } acc) modulesRef
    }
    finalModules
    
  liftEffect do
    let outDir = case Array.findIndex (_ == "--out") args of
                     Just idx -> case Array.index args (idx + 1) of
                                   Just o -> o
                                   Nothing -> "output/purust_output"
                     Nothing -> "output/purust_output"
    srcExists <- FS.exists (outDir <> "/src")
    when (not srcExists) do
      FS.mkdir outDir
      FS.mkdir (outDir <> "/src")
    
    
    allModules <- Ref.read modulesRef
    
    -- Transitive closure of imports
    tcRef <- Ref.new (Map.empty :: Map.Map String (Set.Set String))
    let initTc = Map.toUnfoldable allModules :: Array (Tuple String { code :: String, imports :: Array String })
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

    
    let allShapes = foldl (\acc mod -> Set.union acc (Purust.ASTCollector.collectRecordShapesModule mod)) Set.empty finalModules
    let preludeRsContent = codegenPrelude allShapes
    
    let mainModuleSanitized = String.replaceAll (Pattern ".") (Replacement "_") mainModule
    let workspaceMembers = "\"purust_core\", " <> String.joinWith ", " (map (\(Tuple k _) -> "\"Purs_" <> k <> "\"") (Map.toUnfoldable allModules :: Array (Tuple String { code :: String, imports :: Array String })))
    let rootCargoToml = "[workspace]\nmembers = [\n  " <> workspaceMembers <> "\n]\n\n[package]\nname = \"purust_output\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[profile.release]\ndebug = true\nopt-level = 1\n\n[dependencies]\nmimalloc = \"0.1.32\"\nPurs_" <> mainModuleSanitized <> " = { path = \"Purs_" <> mainModuleSanitized <> "\" }\npurust_core = { path = \"purust_core\" }\nperceus_ptr = { path = \"/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr\" }\n"
    FS.writeTextFile UTF8 (outDir <> "/Cargo.toml") rootCargoToml
    
    FS.writeTextFile UTF8 (outDir <> "/src/main.rs") ("#[global_allocator]\nstatic GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;\n\nfn main() {\n    let mut _effect = Purs_" <> mainModuleSanitized <> "::main();\n    (_effect.unwrap_func1())(purust_core::Value::Record_a(perceus_ptr::PerceusPtr::new(purust_core::Record_a { ..Default::default() })));\n}\n")
    
    let coreDir = outDir <> "/purust_core"
    coreExists <- FS.exists coreDir
    when (not coreExists) do
      FS.mkdir coreDir
      FS.mkdir (coreDir <> "/src")
    FS.writeTextFile UTF8 (coreDir <> "/Cargo.toml") "[package]\nname = \"purust_core\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\nperceus_ptr = { path = \"/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr\" }\nfancy-regex = \"0.13\"\n"
    FS.writeTextFile UTF8 (coreDir <> "/src/lib.rs") preludeRsContent
    
    _ <- foldl (\eff (Tuple k { code: v, imports: imp }) -> eff *> do
      let modDir = outDir <> "/Purs_" <> k
      modExists <- FS.exists modDir
      when (not modExists) do
        FS.mkdir modDir
        FS.mkdir (modDir <> "/src")
      let modDeps = "purust_core = { path = \"../purust_core\" }\nperceus_ptr = { path = \"/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr\" }\nfancy-regex = \"0.13\"\n" <> String.joinWith "\n" (map (\i -> "Purs_" <> i <> " = { path = \"../Purs_" <> i <> "\" }") (fromMaybe [] (map (\s -> Set.toUnfoldable s :: Array String) (Map.lookup k finalTcMap))))
      let modCargoToml = "[package]\nname = \"Purs_" <> k <> "\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n" <> modDeps
      FS.writeTextFile UTF8 (modDir <> "/Cargo.toml") modCargoToml
      let transImps = fromMaybe [] (map (\s -> Set.toUnfoldable s :: Array String) (Map.lookup k finalTcMap))
      let newImportsRust = String.joinWith "\n" (map (\i -> "use Purs_" <> i <> "::*;") transImps)
      let finalCode = String.replace (Pattern "use purust_core::*;\n") (Replacement ("use purust_core::*;\n" <> newImportsRust <> "\n")) v
      FS.writeTextFile UTF8 (modDir <> "/src/lib.rs") finalCode
    ) (pure unit) (Map.toUnfoldable allModules :: Array (Tuple String { code :: String, imports :: Array String }))

    
    log "Successfully generated Rust code."
