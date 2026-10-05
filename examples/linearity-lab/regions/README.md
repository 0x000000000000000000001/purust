# Rank-2 scopes, regions and checked native ownership

Run from the purust repository root:

```sh
node examples/linearity-lab/run.mjs --suite regions
```

The runner compiles each static case from fresh TAST, verifies the diagnostic
for each rejection, and executes `RuntimeDemo` through purust in both normal
and threaded modes. Reports and generated Rust are saved under
`../artifacts/regions`. `Rank2` and `Region` are static signature experiments:
their foreign declarations are not implemented or executed. `Guarded` and the
installed ST port are executed.

| Experiment | Observed result | What it establishes |
| --- | --- | --- |
| Rank-2 callback: inspect then finish | Accepted | Ordinary scoped use is possible. |
| Rank-2 callback: alias then finish twice | Accepted | A fresh scope is not a usage count. |
| Rank-2 callback: return the handle directly | Rejected | The fresh scope cannot unify with the caller's scope. |
| Rank-2 callback: return `Effect Int` capturing the handle | Accepted | Plain `Effect` hides the scope; the action can escape and replay. |
| Rank-2 callback: existentially package the handle | Accepted | Hiding the scope also permits escape; unindexed `Effect` operations remain usable. |
| Abstract `Region scope a`: finish an alias twice | Accepted | Confinement alone does not guarantee at-most-once consumption. |
| Abstract `Region scope a`: return a handle or indexed action | Rejected | The result still mentions the fresh scope. |
| Abstract `Region scope a`: existentially package a handle | Accepted | A hidden handle can be returned as inert data. |
| Run an operation on that existential handle | Rejected | A fixed hidden scope does not satisfy a computation valid for every scope. |
| Installed ST: write through two aliases | Accepted; executes to 30 | ST deliberately permits aliases within its region. |
| Installed ST: return a reference directly | Rejected | The actual ST runner enforces the same direct scope boundary. |

There are 13 static cases: eight accepted and five rejected. They use ordinary
PureScript, without `unsafeCoerce`. The existential is a small Church encoding,
so its behavior is visible in the source rather than delegated to a library.

The important difference is between
`(forall scope. Handle scope -> Effect a) -> Effect a` and a runner requiring
`forall scope. Region scope a`. The former leaves operations in unrestricted,
unindexed `Effect`. The latter keeps operations indexed by the region and hides
the constructor and conversion to `Effect`; `Region` has a nominal scope role.
Exposing an unchecked conversion or unsafe coercion would change that contract.
Neither signature makes a handle linear. A complete FFI API still has to specify
which operations consume a resource and how repeated consumption is handled.

This follows the scope mechanism of the official
[PureScript ST API](https://pursuit.purescript.org/packages/purescript-st/6.2.0/docs/Control.Monad.ST):
its runner accepts a computation polymorphic in the region, while `ST` carries
that region in its type. This suite tests the installed port as well as a minimal
FFI-oriented version of that signature.

## Runtime fallback

`Guarded.rs` keeps a real Rust `Session`, which implements neither `Clone` nor
`Copy`, inside `Arc<Mutex<Option<Session>>>`. Only the wrapper is shared.
Inspection uses a checked borrowed reference while holding the lock. Consumption
uses [`Option::take`](https://doc.rust-lang.org/std/option/enum.Option.html#method.take)
under the lock, then invokes `Session::finish(self)` after releasing it. Every
alias observes the same empty slot after consumption. The wrapper contains no
`unsafe` code or raw pointers.

The executable checks all of the following:

- Replaying the exact same consuming `Effect` returns `Consumed` on the second run.
- Consuming an alias, or inspecting it after consumption, also returns `Consumed`.
- Native code calls back into a PureScript action while holding a borrow; a
  consuming reentrant call returns `Busy` rather than deadlocking. The resource
  remains usable after the borrow ends.
- Two real Rust threads race to consume the same resource. One succeeds and one
  observes `Consumed`; transient contention is retried inside this race test.
- Three native sessions are created, consumed once each, and dropped once each.
- The actual ST alias example evaluates to 30.

[`Mutex::try_lock`](https://doc.rust-lang.org/std/sync/struct.Mutex.html#method.try_lock)
provides the nonblocking conflict check. The demo uses diagnostic integers:
non-negative success, `-1` consumed, `-2` busy, and `-3` poisoned. A general public
API should expose a typed result instead; negative successful values are outside
this demo's ABI. Poisoning is handled in code but is not injected in this suite.
This is an at-most-once runtime guarantee for the native consumption operation,
not a compile-time rejection of invalid PureScript programs. Unused resources
can still be dropped without calling `finish`; an exactly-once protocol requires
an additional policy. The test does not establish arbitrary asynchronous
cancellation or fairness behavior.

The normal backend retains its usual local outer handle. The native guard uses
an inner `Arc` intentionally so its explicit thread-race test works in both
backend modes; the threaded backend also uses its normal outer `Arc` convention.

## API and implementation cost

| Route | Cost for an API author and caller |
| --- | --- |
| Rank-2 callback alone | Modest signature complexity, but insufficient for ownership: callbacks and existentials are easy escape routes when operations return `Effect`. |
| Abstract region-indexed effect | Every operation must preserve the region, constructors/conversions must remain private, and higher-rank errors are harder to read. It gives scope confinement, not linear use. |
| Checked runtime owner | Familiar `Effect` operations and unrestricted handles; callers must handle consumed/busy results. Implementers maintain the guard, lock behavior, and lifetime of callbacks. Refcounting, locking and state checks have a runtime cost; this suite does not benchmark it. |

These routes can be combined: a scoped API can reduce accidental escape while a
runtime owner guard enforces consumption when aliases remain possible.
