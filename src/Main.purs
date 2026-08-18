module Main where

import Prelude
import Effect (Effect)
import Effect.Console (log)
import Effect.Aff (Aff, launchAff_)
import Node.FS.Sync as FS
import Node.Encoding (Encoding(..))
import Node.Process as Process
import Data.Array as Array
import Data.Maybe (Maybe(..))
import Data.Set as Set
import Data.Newtype (unwrap)
import PureScript.Backend.Optimizer.Builder (buildModules)
import PureScript.Backend.Optimizer.Directives.Defaults (defaultDirectives)
import PureScript.Backend.Optimizer.Semantics.Foreign (coreForeignSemantics)
import PureScript.Backend.Optimizer.App (coreFnModulesFromOutput, checkCache, writeCache, loadDirectives)
import Purust.CodeGen (codegenModule, codegenPrelude, sanitizeIdent, getArity)
import Purust.ASTCollector as Purust.ASTCollector
import PureScript.Backend.Optimizer.CoreFn (Module(..), Bind(..), Binding(..), Expr(..), Ident(..), ExprType(..), Ann(..), ModuleName(..), Import(..))
import Data.Map as Map
import Data.List as List
import Data.Set as Set
import Data.Array as Array
import Data.String as String
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
  
  finalModules <- coreFnModulesFromOutput "output"
  
  let
    buildGlobalArities :: List.List (Module Ann) -> Map.Map String ExprType
    buildGlobalArities modules = foldl processModule Map.empty modules
      where
      processModule acc (Module mod) =
        let 
          modPrefix = String.replaceAll (Pattern ".") (Replacement "_") (unwrap mod.name) <> "_"
          
          acc1 = foldl (\a (Tuple (Ident name) mbTy) -> 
              case mbTy of
                Just ty -> Map.insert (modPrefix <> sanitizeIdent name) ty a
                Nothing -> a
            ) acc (Map.toUnfoldable mod.foreign :: Array (Tuple Ident (Maybe ExprType)))
            
          acc2 = foldl (\a decl -> 
              foldl (\a2 ctor -> 
                Map.insert (modPrefix <> sanitizeIdent ctor.name) Any a2
              ) a decl.constructors
            ) acc1 mod.dataDecls
            
          getTy (Ann ann) = ann.type
          
          extractAnn :: Expr Ann -> Ann
          extractAnn = case _ of
            ExprVar ann _ -> ann
            ExprLit ann _ -> ann
            ExprAbs ann _ _ -> ann
            ExprApp ann _ _ -> ann
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
              
        in foldl processBind acc2 mod.decls
        
  let globalArities = buildGlobalArities finalModules
  
  directives <- loadDirectives
  
  modulesRef <- liftEffect $ Ref.new (Map.empty :: Map.Map String { code :: String, imports :: Array String })
  
  buildModules
    { directives
    , analyzeCustom: \_ _ -> Nothing
    , foreignSemantics: coreForeignSemantics
    , traceIdents: Set.empty
    , onPrepareModule: \_ (Module m) -> pure (Module m)
    , onSkipModule: \_ (Module coreFnMod) -> do
        let modNameStr = unwrap coreFnMod.name
        checkCache cacheVersion coreFnMod.path ("output/" <> modNameStr <> "/.purust-cache.json")
    , onCodegenModule: \_ (Module coreFnMod) backendMod _ -> do
        let modNameStr = unwrap backendMod.name
        writeCache cacheVersion ("output/" <> modNameStr <> "/.purust-cache.json") backendMod
        let rsFile = codegenModule globalArities (Module coreFnMod) backendMod
        
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
                let arity = getArity ty
                    args = Array.mapWithIndex (\i _ -> "mut a" <> show i <> ": UnknownType") (Array.replicate arity unit)
                in "pub fn " <> modPrefix <> sanitizeIdent (unwrap name) <> "(" <> String.joinWith ", " args <> ") -> UnknownType { UnknownType::new(Record_a { ..Default::default() }) }\n"
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
          
          let allModNames = map (\(Module m) -> unwrap m.name) (Array.fromFoldable finalModules)
          let allModStrs = map (\n -> String.replaceAll (Pattern ".") (Replacement "_") n) allModNames
          let getMaskedFile str = 
                let longerPrefixes = Array.filter (\other -> other /= str && String.contains (Pattern str) other) allModStrs
                in foldl (\acc other -> String.replaceAll (Pattern other) (Replacement "MASKED") acc) rsFile longerPrefixes
          let extraImports = Array.mapMaybe (\modStr -> 
                let modPrefix2 = modStr <> "_"
                    maskedFile = getMaskedFile modStr
                in if modStr /= modName && String.contains (Pattern modPrefix2) maskedFile then Just modStr else Nothing
              ) allModStrs
          
          let rawModules = Set.toUnfoldable (Purust.ASTCollector.collectModulesModule (Module coreFnMod)) :: Array String
          let coreImports = Array.nub (Array.mapMaybe (\n -> 
                let nStr = String.replaceAll (Pattern ".") (Replacement "_") n
                    isSelf = nStr == modName
                in if n == "Prim" || String.indexOf (Pattern "Prim.") n == Just 0 || isSelf then Nothing else Just nStr
              ) (Array.concat [extraImports, rawModules]))
          let importsRust = String.joinWith "\n" (map (\i -> "use Purs_" <> i <> "::*;") coreImports)
          let rustCode = "#![allow(warnings)]\nuse perceus_ptr::PerceusPtr;\nuse purust_core::*;\n" <> importsRust <> "\n\n" <> rsFile <> "\n\n" <> ffiContent <> "\n\n"
          Ref.modify_ (\acc -> Map.insert modName { code: rustCode, imports: coreImports } acc) modulesRef
    }
    finalModules
    
  liftEffect do
    let outDir = "output/purust_output"
    srcExists <- FS.exists (outDir <> "/src")
    when (not srcExists) do
      FS.mkdir outDir
      FS.mkdir (outDir <> "/src")
    
    allModules <- Ref.read modulesRef
    
    let allFields = foldl (\acc mod -> Set.union acc (Purust.ASTCollector.collectFieldsModule mod)) Set.empty finalModules
    let preludeRsContent = codegenPrelude allFields
    
    let mainModuleSanitized = String.replaceAll (Pattern ".") (Replacement "_") mainModule
    let workspaceMembers = "\"purust_core\", " <> String.joinWith ", " (map (\(Tuple k _) -> "\"Purs_" <> k <> "\"") (Map.toUnfoldable allModules :: Array (Tuple String { code :: String, imports :: Array String })))
    let rootCargoToml = "[workspace]\nmembers = [\n  " <> workspaceMembers <> "\n]\n\n[package]\nname = \"purust_output\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\nPurs_" <> mainModuleSanitized <> " = { path = \"Purs_" <> mainModuleSanitized <> "\" }\n"
    FS.writeTextFile UTF8 (outDir <> "/Cargo.toml") rootCargoToml
    
    FS.writeTextFile UTF8 (outDir <> "/src/main.rs") ("fn main() {\n    Purs_" <> mainModuleSanitized <> "::main();\n}\n")
    
    let coreDir = outDir <> "/purust_core"
    FS.mkdir coreDir
    FS.mkdir (coreDir <> "/src")
    FS.writeTextFile UTF8 (coreDir <> "/Cargo.toml") "[package]\nname = \"purust_core\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\nperceus_ptr = { path = \"/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr\" }\nfancy-regex = \"0.13\"\n"
    FS.writeTextFile UTF8 (coreDir <> "/src/lib.rs") preludeRsContent
    
    _ <- foldl (\eff (Tuple k { code: v, imports: imp }) -> eff *> do
      let modDir = outDir <> "/Purs_" <> k
      FS.mkdir modDir
      FS.mkdir (modDir <> "/src")
      let modDeps = "purust_core = { path = \"../purust_core\" }\nperceus_ptr = { path = \"/Users/0x1/Documents/htdocs/purust/purust/tests/runtime/perceus_ptr\" }\nfancy-regex = \"0.13\"\n" <> String.joinWith "\n" (map (\i -> "Purs_" <> i <> " = { path = \"../Purs_" <> i <> "\" }") imp)
      let modCargoToml = "[package]\nname = \"Purs_" <> k <> "\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n" <> modDeps
      FS.writeTextFile UTF8 (modDir <> "/Cargo.toml") modCargoToml
      FS.writeTextFile UTF8 (modDir <> "/src/lib.rs") v
    ) (pure unit) (Map.toUnfoldable allModules :: Array (Tuple String { code :: String, imports :: Array String }))

    
    log "Successfully generated Rust code."
