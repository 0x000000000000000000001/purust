# Indexed row capabilities

This experiment checks resource use through a reusable indexed computation API.
It uses the existing PureScript type checker and a real, non-`Clone` Rust
resource. It does not add linear types to PureScript or infer ownership rules
from arbitrary Rust signatures.

Run from the `purust` repository root:

```sh
node examples/linearity-lab/run.mjs --suite indexed
```

The suite has seven accepted examples and twenty-one rejected examples. Two
executables run through `purust` in both normal and `--threaded` modes. The
original example opens two resources, reads through an alias, mutates the
second resource, finishes both, then replays the same outer `Effect`. Native
assertions verify four distinct constructions, four consuming calls, four
drops and two correct results. The extended example executes both branches
of a conditional, recursive borrowing, indexed callbacks and dynamic repetition
of separate resource scopes. Threaded mode tests compatibility, not concurrent
scheduling.

## What the caller writes

```purescript
action = R.run R.do
  first <- R.open (Proxy :: Proxy "first") 10
  second <- R.open (Proxy :: Proxy "second") 20
  observed <- R.inspect first
  R.add second observed
  left <- R.finish first
  right <- R.finish second
  R.pure (left + right)
```

There is no `Open`/`Closed` type to invent for each resource. Intermediate
states are inferred. Callers do use qualified `do`, fresh symbolic resource
names and this API's operations. Generic helpers may need explicit row
constraints, and compiler errors expose those types. This is less manual
protocol modelling, not a completely transparent FFI.

For a single-resource scope, the name and row machinery can be hidden by an
ordinary library helper. `Helpers.withSession` provides this interface without
introducing new state ADTs:

```purescript
recursive = withSession 10 \resource -> R.do
  observed <- borrowLoop resource 4
  final <- consumeWith resource \session -> R.do
    value <- R.finish session
    R.pure (value + 1)
  R.pure (observed + final)
```

That exact example runs natively and returns `61`: the recursive helper reads
`10`, `11`, `12`, `13` and increments after each read; the callback finishes
at `14` and returns `15`. The caller writes no `Proxy`, capability row or state
type. The implementation of reusable helpers still carries row constraints;
this reduces caller effort rather than removing the library author's work.

## Branches, helpers, callbacks and loops

`BranchBoth` consumes the same resource on both branches. Both branches are
actually executed by `Extended`, returning `7` and `8`. The existing
`PartialBranch` rejects omitting consumption on one branch.

`borrowLoop` is polymorphic in the scope, resource key and capability rows. It
borrows and mutates repeatedly while preserving those indices. `repeatBorrow`
accepts a callback with matching input and output states, so it may call the
callback any number of times. Passing a consuming callback is rejected.
`consumeWith` instead accepts a callback which removes one capability. A
faulty implementation calling that callback twice is rejected in
`DuplicateConsumingHelper`.

There is a practical distinction between two allocation loops:

- `RepeatedAllocation` attempts repeated `open`/`finish` operations under a
  fixed name inside one arena. It is rejected even though each iteration
  would finish its resource: allocation grows the history row and is not a
  state-preserving callback. The current API cannot treat this as a simple
  loop.
- `DynamicScopes.allocateMany` uses an ordinary `Effect` recursion and
  `withSession` on each iteration. It is accepted without `Proxy` or explicit
  state types. Each iteration has a fresh arena/scope. The executable tests
  three iterations, consumes all three resources and returns `6`.

The latter is useful for independent sequential tasks. It does not provide a
dynamically sized collection of simultaneously live resources in one scope.
The extended executable checks seven constructions, seven consuming calls,
seven drops, four reads and nine mutations in total.

## How it works

`Ix scope before after a` carries two states. Each state has a `history` row
of all names allocated in this run and a `live` row of names not yet consumed.
`open` inserts into both rows, `inspect` and `add` require a live entry, and
`finish` removes that entry. Indexed `bind` matches adjacent states. `run`
starts with empty rows and requires an empty final live row.

The history row matters: removing a name only from `live` would permit opening
another resource under that name and using an old alias to access it. Names
cannot be reused within a run here. `ReopenKey.purs` tests that restriction.

The scoped handle stores a name, never the Rust resource. Rust owns each
`Session` inside a private arena. Its methods use `&self`, `&mut self`, and
`self`, respectively. The arena uses a map and a mutex; map lookups and
assertions remain in this implementation. The static checking happens before
those runtime checks, but this is not a zero-cost resource representation.

Every execution of `run` constructs a new arena inside its `Effect`. Replaying
the outer action is therefore allowed and opens fresh resources. Replaying a
consuming indexed action within the same run is rejected.

## Tested boundaries

- Double consumption, including through a handle alias, a captured helper and
  a reused action, is rejected.
- Reading after consumption, leaving a resource unfinished and finishing on
  only one branch are rejected.
- Reopening a previously used name is rejected.
- Changing a handle's scope/name or changing a computation's state using
  `coerce` is rejected. Those roles are nominal.
- Accessing the hidden handle/computation constructors or raw runner is
  rejected.
- Returning a directly usable scoped handle/action from `run` is rejected.
  A closed handle **can** be stored in an existential package; `Existential`
  deliberately demonstrates this. `ReviveExistential` verifies that the
  hidden handle cannot inspect a fresh resource with the same name.
- `PhantomCounterexample` compiles: a plain `Handle Open -> Handle Closed`
  function does not prevent reuse of an old alias, even with a nominal role.
  This is a static-only example with no native resource to misuse.

For normally returning, safe programs confined to this API, the live row
requires every opened resource to be consumed once. Divergence, exceptions,
panic/cancellation, unsafe coercions and incorrect foreign implementations
are outside that statement. These are executable checks, not a formal proof.

The prototype handles one native resource kind, several statically named
resources in one arena, dynamic repetition of independent single-resource
scopes, and synchronous sequential operations. It does not yet support a
dynamically sized set of simultaneously live resources in one arena, escaping
native borrows, async callbacks, resource transfer between arenas, or
arbitrary ownership relationships in existing Rust APIs. Its FFI adapter was
written manually. The callback examples are synchronous indexed PureScript
callbacks, not native asynchronous callbacks retained by Rust.

## Provenance

This is a new, minimal encoding following the indexed `bind`/`pure` pattern
documented by Gary Burgess's
[purescript-indexed-monad](https://pursuit.purescript.org/packages/purescript-indexed-monad/3.0.0/docs/Control.Bind.Indexed),
including its
[qualified-do approach](https://pursuit.purescript.org/packages/purescript-indexed-monad/3.0.0/docs/Control.Monad.Indexed.Qualified).
It is not a port or execution of that package: this suite implements the
concrete operations directly and does not reproduce its type-class hierarchy.
Its `discard` accepts any result type, whereas the library documents an
`IxDiscard` constraint; discarding a handle still leaves its live capability.

[King, Ng and Yoshida (2019)](https://arxiv.org/html/1904.01287v1), section 3.2.2,
describe hiding communication channels behind an indexed session API and
requiring a terminal state to run it. That work supports the approach, but
uses generated protocol state machines. This resource-row experiment is not
a reproduction of their Scribble generator, network runtime or Battleship
case study.
