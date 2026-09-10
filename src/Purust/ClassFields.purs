module Purust.ClassFields (superclassFields) where

import Prelude

import Data.Array as Array
import Data.Maybe (fromMaybe)
import Data.Tuple (Tuple(..))
import PureScript.Backend.Optimizer.CoreFn (ClassDecl, ExprType(..))

-- Superclass dictionaries are delayed by one ignored argument in CoreFn.
-- Their result type comes from classDecls even when a synthetic projection
-- or application has no annotation of its own.
superclassFields :: ClassDecl -> Array (Tuple String ExprType)
superclassFields declaration = Array.mapWithIndex (\index (Tuple fqn args) ->
  let name = fromMaybe "Super" (Array.last fqn)
  in Tuple (name <> show index) (Func [Any] (ADT name fqn args))
  ) declaration.superclasses
