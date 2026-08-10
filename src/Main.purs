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
import PureScript.Backend.Optimizer.CoreFn (Module(..))
import PureScript.Backend.Optimizer.App (coreFnModulesFromOutput, checkCache, writeCache, loadDirectives)
import Purust.CodeGen (codegenModule)
import PureScript.Backend.Optimizer.FfiSupport (findFfiFile)
import Effect.Console as Console
import Effect.Class (liftEffect)

cacheVersion :: String
cacheVersion = "1.0.0"

main :: Effect Unit
main = launchAff_ do
  _ <- liftEffect Process.argv
  -- very basic parsing for --main
  let mainModule = "Main"
  liftEffect $ log $ "Generating Rust code for " <> mainModule
  
  finalModules <- coreFnModulesFromOutput "output"
  
  directives <- loadDirectives
  
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
        let rsFile = codegenModule (Module coreFnMod) backendMod
        
        liftEffect do
          let outDir = "output/" <> modNameStr
          
          srcExists <- FS.exists (outDir <> "/src")
          when (not srcExists) do
            FS.mkdir (outDir <> "/src")
          
          let cargoToml = "[package]\nname = \"purust_output\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\nperceus_ptr = { path = \"../../../runtime/perceus_ptr\" }\n"
          FS.writeTextFile UTF8 (outDir <> "/Cargo.toml") cargoToml
          
          ffiPathMb <- findFfiFile ".rs" [] (Just "../") modNameStr (Just coreFnMod.path)
          Console.log ("Looking for FFI for " <> modNameStr <> " path: " <> show coreFnMod.path <> " found: " <> show ffiPathMb)
          ffiContent <- case ffiPathMb of
            Just ffiPath -> FS.readTextFile UTF8 ffiPath
            Nothing -> pure ""

          FS.writeTextFile UTF8 (outDir <> "/src/main.rs") (rsFile <> "\n\n" <> ffiContent)
    }
    finalModules
    
  liftEffect $ log "Successfully generated Rust code."
