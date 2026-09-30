-- | Hoist closed subexpressions of top-level bindings into fresh top-level
-- | bindings so the codegen shares them instead of rebuilding them on every
-- | evaluation. Two families are moved:
-- |
-- | - calls to known top-level functions (typically class-instance
-- |   dictionaries built at a use site);
-- | - closed lambdas used as arguments, which the codegen then references as
-- |   statics instead of allocating a closure per call.
-- |
-- | Record literals and constructor trees are deliberately left in place:
-- | their field conversions depend on the surrounding expected type, so
-- | moving them would change the generated representation. PureScript is
-- | pure, so sharing a closed value is observationally equivalent; the pass
-- | additionally refuses expressions that could make a module-value
-- | initialization reach the binding they came from.
module Purust.Caf (hoistClosedValues) where

import Prelude

import Data.Array as Array
import Data.Foldable (foldMap, foldl)
import Data.Map (Map)
import Data.Map as Map
import Data.Maybe (Maybe(..))
import Data.Newtype (unwrap)
import Data.Set (Set)
import Data.Set as Set
import Data.Traversable (traverse)
import Data.Tuple (Tuple(..), snd)
import PureScript.Backend.Optimizer.Convert (BackendBindingGroup)
import PureScript.Backend.Optimizer.CoreFn (Ident(..), Literal(..), ModuleName, Prop(..), Qualified(..))
import PureScript.Backend.Optimizer.Semantics (NeutralExpr(..))
import PureScript.Backend.Optimizer.Syntax (BackendOperator(..), BackendSyntax(..), Level(..), Pair(..))

type Groups = Array (BackendBindingGroup Ident NeutralExpr)

type State =
  { hoisted :: Array (Tuple Ident NeutralExpr)
  , next :: Int
  , names :: Set String
  }

-- State threading for the child traversal without a monad-transformer
-- dependency.
newtype Walk a = Walk (State -> Tuple State a)

runWalk :: forall a. State -> Walk a -> Tuple State a
runWalk state (Walk run) = run state

instance functorWalk :: Functor Walk where
  map f (Walk run) = Walk \state -> case run state of
    Tuple state' value -> Tuple state' (f value)

instance applyWalk :: Apply Walk where
  apply (Walk runF) (Walk runA) = Walk \state -> case runF state of
    Tuple state' f -> case runA state' of
      Tuple state'' a -> Tuple state'' (f a)

instance applicativeWalk :: Applicative Walk where
  pure value = Walk \state -> Tuple state value

instance bindWalk :: Bind Walk where
  bind (Walk run) f = Walk \state -> case run state of
    Tuple state' value -> case f value of
      Walk next -> next state'

instance monadWalk :: Monad Walk

hoistClosedValues
  :: Set String
  -> ModuleName
  -> (NeutralExpr -> Boolean)
  -> Groups
  -> { groups :: Groups, hoisted :: Array (Tuple Ident NeutralExpr) }
hoistClosedValues reserved moduleName isValue groups =
  let
    names = Set.union reserved (Set.fromFoldable (Array.concatMap (map (\(Tuple (Ident name) _) -> name) <<< _.bindings) groups))
    deps = Map.fromFoldable
      (Array.concatMap (\group -> map (\(Tuple (Ident name) expr) -> Tuple (Ident name) (topRefs expr)) group.bindings) groups)
    initial = { hoisted: [], next: 0, names }
    hoist expr = Walk \state ->
      let
        Tuple name next = chooseName state.next state.names
        ident = Ident name
        stateNext = state
          { hoisted = Array.snoc state.hoisted (Tuple ident expr)
          , next = next
          , names = Set.insert name state.names
          }
      in Tuple stateNext (NeutralExpr (Var (Qualified (Just moduleName) ident)))
    walk owner (NeutralExpr syn) = do
      inner <- traverse (walk owner) syn
      let expr = NeutralExpr inner
      if worth expr && isValue expr && closed expr && not (Array.any (\name -> reaches deps name owner) (Array.fromFoldable (topRefs expr)))
        then hoist expr
        else pure expr
    step { state, result } group = 
      let
        folded :: { state :: State, bindings :: Array (Tuple Ident NeutralExpr) }
        folded = Array.foldl (\acc (Tuple ident expr) -> case runWalk acc.state (walk ident expr) of
          Tuple state' expr' -> { state: state', bindings: Array.snoc acc.bindings (Tuple ident expr') }
          ) { state, bindings: [] } group.bindings
        updated = group { bindings = folded.bindings }
      in { state: folded.state, result: Array.snoc result updated }
    final = foldl step { state: initial, result: [] } groups
  in
    if Array.null final.state.hoisted then { groups, hoisted: [] }
    else { groups: Array.snoc final.result { recursive: false, bindings: final.state.hoisted }, hoisted: final.state.hoisted }

chooseName :: Int -> Set String -> Tuple String Int
chooseName index names =
  let name = "__purust_caf_" <> show index
  in if Set.member name names then chooseName (index + 1) names else Tuple name (index + 1)

worth :: NeutralExpr -> Boolean
worth expr = hoistable expr && countNodes expr >= 6 && allocNodes expr > 0

-- Calls to known top-level functions use the callee's signature for their
-- arguments and result, and a closed lambda only needs its own parameter
-- types. Record literals and constructor trees are context-sensitive and
-- stay in place.
hoistable :: NeutralExpr -> Boolean
hoistable (NeutralExpr syn) = case syn of
  Typed _ inner -> hoistable inner
  TypeApp inner _ -> hoistable inner
  App fn _ -> topRef fn
  UncurriedApp fn _ -> topRef fn
  Abs _ _ -> true
  UncurriedAbs _ _ -> true
  UncurriedEffectAbs _ _ -> true
  _ -> false

topRef :: NeutralExpr -> Boolean
topRef (NeutralExpr syn) = case syn of
  Var _ -> true
  Typed _ inner -> topRef inner
  TypeApp inner _ -> topRef inner
  _ -> false

closed :: NeutralExpr -> Boolean
closed expr = Set.isEmpty (freeVariables expr)

-- Lexical liveness over the backend syntax. Locals are identified by their
-- name (or level when anonymous), like the codegen's capture analysis; a
-- collision only makes the test more conservative.
freeVariables :: NeutralExpr -> Set String
freeVariables (NeutralExpr expr) = case expr of
  TypeApp a _ -> freeVariables a
  Var _ -> Set.empty
  Local mbId lvl -> Set.singleton (localKey mbId lvl)
  App fn args -> Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) (Array.fromFoldable args)
  Let mbId lvl val body -> Set.union (freeVariables val) (Set.delete (localKey mbId lvl) (freeVariables body))
  Typed _ inner -> freeVariables inner
  Update base props -> Array.foldl (\acc (Prop _ v) -> Set.union acc (freeVariables v)) (freeVariables base) props
  Branch branches def -> Set.union
    (Array.foldl (\acc (Pair cond body) -> Set.union acc (Set.union (freeVariables cond) (freeVariables body))) Set.empty (Array.fromFoldable branches))
    (freeVariables def)
  PrimOp (Op1 _ a) -> freeVariables a
  PrimOp (Op2 _ a b) -> Set.union (freeVariables a) (freeVariables b)
  PrimEffect operation -> foldMap freeVariables operation
  Accessor base _ -> freeVariables base
  EffectBind mbIdent lvl val body -> Set.union (freeVariables val) (Set.delete (localKey mbIdent lvl) (freeVariables body))
  EffectPure val -> freeVariables val
  LetRec _ binds body ->
    let
      bindsVars = Array.foldl (\acc (Tuple (Ident n) _) -> Set.insert n acc) Set.empty (Array.fromFoldable binds)
    in Set.difference (Set.union (Array.foldl (\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty (Array.fromFoldable binds)) (freeVariables body)) bindsVars
  Abs params body -> Set.difference (freeVariables body) (Array.foldl (\acc (Tuple mbId lvl) -> Set.insert (localKey mbId lvl) acc) Set.empty (Array.fromFoldable params))
  UncurriedAbs params body -> Set.difference (freeVariables body) (Array.foldl (\acc (Tuple mbId lvl) -> Set.insert (localKey mbId lvl) acc) Set.empty params)
  UncurriedEffectAbs params body -> Set.difference (freeVariables body) (Array.foldl (\acc (Tuple mbId lvl) -> Set.insert (localKey mbId lvl) acc) Set.empty params)
  UncurriedApp fn args -> Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args
  UncurriedEffectApp fn args -> Array.foldl (\acc a -> Set.union acc (freeVariables a)) (freeVariables fn) args
  Fail _ -> Set.empty
  EffectDefer inner -> freeVariables inner
  Lit (LitArray arr) -> Array.foldl (\acc a -> Set.union acc (freeVariables a)) Set.empty arr
  Lit (LitRecord props) -> Array.foldl (\acc (Prop _ v) -> Set.union acc (freeVariables v)) Set.empty props
  CtorSaturated _ _ _ _ fields -> Array.foldl (\acc (Tuple _ v) -> Set.union acc (freeVariables v)) Set.empty fields
  _ -> Set.empty

localKey :: Maybe Ident -> Level -> String
localKey (Just (Ident name)) level = name <> "_" <> show (unwrap level)
localKey Nothing level = "lvl_" <> show (unwrap level)

-- All module-level references. Only local bindings appear as keys of the
-- dependency graph, so a foreign reference simply cannot reach anything.
topRefs :: NeutralExpr -> Set Ident
topRefs (NeutralExpr syn) = case syn of
  Var (Qualified _ ident) -> Set.singleton ident
  _ -> foldMap topRefs syn

countNodes :: NeutralExpr -> Int
countNodes (NeutralExpr syn) = 1 + foldl (\acc child -> acc + countNodes child) 0 syn

allocNodes :: NeutralExpr -> Int
allocNodes (NeutralExpr syn) = alloc syn + foldl (\acc child -> acc + allocNodes child) 0 syn
  where
  alloc = case _ of
    App _ _ -> 1
    UncurriedApp _ _ -> 1
    UncurriedEffectApp _ _ -> 1
    CtorSaturated _ _ _ _ _ -> 1
    Abs _ _ -> 1
    UncurriedAbs _ _ -> 1
    UncurriedEffectAbs _ _ -> 1
    Branch _ _ -> 1
    Lit (LitArray _) -> 1
    Lit (LitRecord _) -> 1
    PrimEffect _ -> 1
    _ -> 0

reaches :: Map Ident (Set Ident) -> Ident -> Ident -> Boolean
reaches deps start target = go Set.empty start
  where
  go seen current
    | current == target = true
    | Set.member current seen = false
    | otherwise = case Map.lookup current deps of
        Nothing -> false
        Just next -> Array.any (go (Set.insert current seen)) (Array.fromFoldable next)
