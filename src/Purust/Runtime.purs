module Purust.Runtime (writeRuntime, runtimeDependency, microtasksSource) where

import Prelude

import Data.Foldable (traverse_)
import Effect (Effect)
import Node.Encoding (Encoding(..))
import Node.FS.Sync as FS

foreign import runtimeFiles :: Array { path :: String, content :: String }
foreign import microtasksSource :: String

writeRuntime :: String -> Effect Unit
writeRuntime outDir = do
  let runtimeDir = outDir <> "/perceus_ptr"
  traverse_ (\directory -> do
    exists <- FS.exists directory
    when (not exists) (FS.mkdir directory)
    ) [ runtimeDir, runtimeDir <> "/src" ]
  traverse_ (\file -> FS.writeTextFile UTF8 (runtimeDir <> "/" <> file.path) file.content) runtimeFiles

runtimeDependency :: Boolean -> String -> String
runtimeDependency threaded relativePath =
  "perceus_ptr = { path = \"" <> relativePath <> "\""
    <> (if threaded then ", features = [\"threaded\"]" else "") <> " }\n"
