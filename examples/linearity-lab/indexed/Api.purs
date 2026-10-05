module LinearLab.Indexed.Api
  ( Ix, State, Handle, pure, bind, discard, open, inspect, add, finish, run
  ) where

import Prelude hiding (bind, discard, pure)
import Prelude as P
import Data.Symbol (class IsSymbol, reflectSymbol)
import Effect (Effect)
import Prim.Row as Row
import Type.Proxy (Proxy)

-- History prevents recycling a key: an old alias must not gain access to a
-- newly opened resource. Live tracks the capabilities still requiring finish.
data State :: Row Type -> Row Type -> Type
data State history live

foreign import data Arena :: Type
newtype Handle :: Type -> Symbol -> Type
newtype Handle scope key = Handle String
type role Handle nominal nominal

newtype Ix :: Type -> Type -> Type -> Type -> Type
newtype Ix scope before after a = Ix (Arena -> Effect a)
type role Ix nominal nominal nominal representational

foreign import newArena :: Effect Arena
foreign import rawOpen :: Arena -> String -> Int -> Effect Unit
foreign import rawInspect :: Arena -> String -> Effect Int
foreign import rawAdd :: Arena -> String -> Int -> Effect Unit
foreign import rawFinish :: Arena -> String -> Effect Int
foreign import checkEmpty :: Arena -> Effect Unit

pure :: forall scope state a. a -> Ix scope state state a
pure value = Ix (\_ -> P.pure value)

bind :: forall scope before middle after a b.
  Ix scope before middle a -> (a -> Ix scope middle after b) -> Ix scope before after b
bind (Ix first) next = Ix \arena -> P.do
  value <- first arena
  case next value of
    Ix second -> second arena

discard :: forall scope before middle after a b.
  Ix scope before middle a -> (a -> Ix scope middle after b) -> Ix scope before after b
discard = bind

open :: forall scope key used usedNext live liveNext.
  IsSymbol key => Row.Lacks key used =>
  Row.Cons key Unit used usedNext => Row.Cons key Unit live liveNext =>
  Proxy key -> Int ->
  Ix scope (State used live) (State usedNext liveNext) (Handle scope key)
open key value = Ix \arena -> P.do
  let name = reflectSymbol key
  rawOpen arena name value
  P.pure (Handle name)

inspect :: forall scope key used live rest.
  Row.Cons key Unit rest live =>
  Handle scope key -> Ix scope (State used live) (State used live) Int
inspect (Handle key) = Ix \arena -> rawInspect arena key

add :: forall scope key used live rest.
  Row.Cons key Unit rest live =>
  Handle scope key -> Int -> Ix scope (State used live) (State used live) Unit
add (Handle key) amount = Ix \arena -> rawAdd arena key amount

finish :: forall scope key used live rest.
  Row.Cons key Unit rest live =>
  Handle scope key -> Ix scope (State used live) (State used rest) Int
finish (Handle key) = Ix \arena -> rawFinish arena key

-- The result cannot mention scope. The empty final live row requires every
-- resource to be finished on a normally returning path.
run :: forall used a.
  (forall scope. Ix scope (State () ()) (State used ()) a) -> Effect a
run program = P.do
  arena <- newArena
  result <- case program of
    Ix action -> action arena
  checkEmpty arena
  P.pure result
