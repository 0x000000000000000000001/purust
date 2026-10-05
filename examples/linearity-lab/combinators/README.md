# Generic linear combinators

This suite tests the library route discussed by Phil Freeman, separately from
the earlier `Open`/`Closed` session protocol. The result is promising within a
restricted DSL: no per-resource state machine is required, but the developer
must express resource flow with combinators instead of ordinary lambdas.

Run from the `purust` repository:

```sh
node examples/linearity-lab/run.mjs --suite combinators
```

## Provenance and what was actually tested

[Phil's 2017 article](https://blog.functorial.com/posts/2017-08-05-Embedding-Linear-Lambda-Calculus.html)
describes hiding the constructor of a linear arrow and exposing safe
combinators. It credits rightfold's `purescript-substructural`.

The original `rightfold/purescript-substructural` GitHub endpoint returned 404
during this investigation. A public historical copy was found at
[`nfgrusk/purescript-substructural`, commit `51f4c37c80f196b7521542d60f6f428b6039949d`](https://github.com/nfgrusk/purescript-substructural/tree/51f4c37c80f196b7521542d60f6f428b6039949d).
This June 2017 snapshot predates Phil's August article; it is not a claim to
have retrieved the last release. Pursuit also preserves
[the package's 0.0.19 documentation](https://pursuit.purescript.org/packages/purescript-substructural/0.0.19).

There are two distinct experiments here:

1. **Historical API compatibility, type checking only.** `Historical.purs`
   copies the snapshot's `src/Data/Function/Sub.purs`, retaining its BSD
   license in `HISTORICAL-LICENSE`. Changes are limited to the module name,
   an explicit `Data.Void` import, and updating the old `Category.id` member
   to `identity`. The historical JavaScript implementation was inspected,
   but is not executed by this suite. `HistoricalResource.purs` supplies
   foreign signatures solely for the type-checking probes; it has no native
   implementation.
2. **A new first-order Rust adaptation, actually executed.** `Linear.purs`
   exposes opaque arrows with composition, identity, tensor, swap and pair
   associators. `Linear.rs` interprets their descriptions with real owned
   native resources. This is not a port of the whole original package or
   of the full higher-order BCI calculus in Phil's article.

## Resource flow without per-resource state tags

```purescript
open   :: Linear Int Session
add    :: Int -> Linear Session Session
finish :: Linear Session Int

pipeline = then_ open (then_ (add 7) finish)
```

`finish` consumes the actual native resource at that point in execution.
It is not a final marker interpreted only at the end. `tensor finish finish`
takes a pair of **two** resources and consumes both. `swap` rearranges
ownership without duplicating either resource.

The native `NativeSession` and interpreter `Datum` types have no `Clone` or
`Copy` implementation. Rust code moves them through the evaluator, borrows
temporarily for `add` and `inspect`, then calls `finish(self)`. Only immutable
instruction descriptions use reference counting. There is no dynamic
consumed flag or runtime uniqueness test.

The execution boundary is intentionally narrow:

```purescript
runInt :: Linear Int Int -> Int -> Effect Int
```

Live resources never become ordinary PureScript values. Arrows and effects
can be reused: each execution opens fresh resources. A general
`run :: Linear a b -> a -> b` would undo this confinement and is not exposed.
Likewise there is no unrestricted callback-lifting operation.

The historical API generalizes the boundary using `Shared` constraints on
both inputs and outputs of `runShared` and `liftShared`. Its `borrow`
requires a `Shared` result. The probes confirm that the tested resource
cannot cross those boundaries without the required instances. This gives
a concrete path beyond the adaptation's fixed `Int` boundary, while still
requiring lawful, trusted instances and primitives.

## Observed results

All **21 typing cases** passed their expected outcome: **16 rejected** and
**5 accepted**. The accepted cases include an explicitly unsafe negative
control, which is never executed. Rejections cover double consumption,
attempted duplication/discard, ordinary-function insertion, access to
private constructors/builders, independent input/output coercions,
unwrapping, resource escape, and the historical API's sharing constraints.

Both normal and `--threaded` native builds print:

```text
LINEAR_COMBINATORS_OK resources=4 results=17,17,23,30
```

Assertions verify four separate resources created, explicitly finished,
and dropped. The example replays an effect, handles two resources at once,
and exercises reassociation. `--threaded` verifies compatibility with that
runtime mode; this example does not spawn threads.

Exact diagnostics, commands and native output are regenerated under
`../artifacts/combinators/`. No performance claim is made.

## Costs and limits

The library author still supplies correct primitive signatures and trusted
implementations. The user routes values through `then_`, `tensor`, `swap`,
and associators. This can be more mechanical than inventing `Open/Closed`
types for every API, but it remains less natural than ordinary `do` code.
Generating these adapters from Rust signatures is separate work.

This is a static restriction on programs built through this safe API,
supported by adversarial probes, not a formal soundness proof or a new
type system for all PureScript. It does not recover arbitrary Rust
lifetimes, expose borrowed references or unrestricted resource callbacks,
or accept resources already aliased elsewhere. The native interpreter's
shape matches rely on trusted primitive implementations. Explicit unsafe
coercions, dishonest FFI and invalid historical type-class instances are
outside the guarantee. Termination, cleanup on panic, cancellation and
concurrent scheduling are not established by these examples.
