module Purust.Dependencies (transitiveImports) where

import Prelude
import Data.Array as Array
import Data.Foldable (foldl)
import Data.Map as Map
import Data.Maybe (fromMaybe)
import Data.Set as Set
import Data.Tuple (Tuple(..))

-- Include referenced external names as leaf vertices, but return only the
-- original module keys. Numbering follows the canonical String ordering.
transitiveImports :: Map.Map String (Set.Set String) -> Map.Map String (Set.Set String)
transitiveImports graph =
  let
    names = Set.toUnfoldable (Set.unions (Array.cons (Map.keys graph)
      (Array.fromFoldable (Map.values graph)))) :: Array String
    indices = Map.fromFoldable (Array.mapWithIndex (\i name -> Tuple name i) names)
    edges = map (\name -> Array.mapMaybe (flip Map.lookup indices)
      (Set.toUnfoldable (fromMaybe Set.empty (Map.lookup name graph)) :: Array String)) names
    closed = closureImpl closurePure edges
  in Map.fromFoldable $ map (\name -> Tuple name $ Set.fromFoldable $ Array.mapMaybe (Array.index names)
       (fromMaybe [] (Map.lookup name indices >>= Array.index closed)))
       (Set.toUnfoldable (Map.keys graph) :: Array String)

foreign import closureImpl :: (Array (Array Int) -> Array (Array Int)) -> Array (Array Int) -> Array (Array Int)

-- Same fixed-point rule as Main's original Map/Set loop. No reflexive edges
-- are added unless a nonempty path (including a cycle) reaches that vertex.
closurePure :: Array (Array Int) -> Array (Array Int)
closurePure edges = map Set.toUnfoldable (go (map Set.fromFoldable edges))
  where
  go rows =
    let next = map (\deps -> foldl (\acc i -> Set.union acc
          (fromMaybe Set.empty (Array.index rows i))) deps deps) rows
    in if map Set.size next == map Set.size rows then next else go next
