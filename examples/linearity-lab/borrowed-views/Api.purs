module LinearLab.BorrowedViews.Api
  ( Buffer, View, Ix, Ready, Borrowed
  , pure, bind, discard, withBuffer, withView, checksum, append
  ) where

import Prelude hiding (bind, discard, pure, append)
import Prelude as P
import Effect (Effect)

foreign import data NativeBuffer :: Type
foreign import data NativeView :: Type

data Ready
data Borrowed :: Type -> Type
data Borrowed view

newtype Buffer :: Type -> Type
newtype Buffer scope = Buffer NativeBuffer
type role Buffer nominal
newtype View :: Type -> Type -> Type
newtype View scope view = View NativeView
type role View nominal nominal
newtype Ix :: Type -> Type -> Type -> Type -> Type
newtype Ix scope before after a = Ix (Effect a)
type role Ix nominal nominal nominal representational

foreign import rawWithBuffer :: forall a. String -> (NativeBuffer -> Effect a) -> Effect a
foreign import rawWithView :: forall a. NativeBuffer -> (NativeView -> Effect a) -> Effect a
foreign import rawChecksum :: NativeView -> Effect Int
foreign import rawAppend :: NativeBuffer -> String -> Effect Unit

pure :: forall scope state a. a -> Ix scope state state a
pure value = Ix (P.pure value)

bind :: forall scope before middle after a b.
  Ix scope before middle a -> (a -> Ix scope middle after b) -> Ix scope before after b
bind (Ix first) next = Ix P.do
  value <- first
  case next value of
    Ix second -> second

discard :: forall scope before middle after a b.
  Ix scope before middle a -> (a -> Ix scope middle after b) -> Ix scope before after b
discard = bind

withBuffer :: forall a. String -> (forall scope. Buffer scope -> Ix scope Ready Ready a) -> Effect a
withBuffer initial use = rawWithBuffer initial \native ->
  case use (Buffer native) of
    Ix action -> action

withView :: forall scope a.
  Buffer scope ->
  (forall view. View scope view -> Ix scope (Borrowed view) (Borrowed view) a) ->
  Ix scope Ready Ready a
withView (Buffer native) use = Ix (rawWithView native \view ->
  case use (View view) of
    Ix action -> action)

checksum :: forall scope view.
  View scope view -> Ix scope (Borrowed view) (Borrowed view) Int
checksum (View native) = Ix (rawChecksum native)

append :: forall scope. Buffer scope -> String -> Ix scope Ready Ready Unit
append (Buffer native) suffix = Ix (rawAppend native suffix)
