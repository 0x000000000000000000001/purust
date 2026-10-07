# Conditional ownership capabilities

This experiment extends the opaque-arrow library approach with **conditional
discard, cloning and sharing**, and tests an independently supplied Rust FFI
resource. No compiler, backend, runtime or production FFI source is changed.

Run from the `purust/purust` repository:

```sh
node examples/linearity-lab/run.mjs --suite capabilities
```

The shared harness compiles fresh PureScript through the local fork's typed
`tcorefn`, runs purust, then builds and executes Rust offline in both normal and
`--threaded` modes. Cached library dependencies and the local toolchain are
required; no service or network is used. Logs, generated Rust and exact
diagnostics are written to the ignored `../artifacts/capabilities/` directory.

## What the capabilities mean

`Sub a b` is an opaque instruction description with nominal parameter roles.
The `-*` alias and normal `>>>` composition are available. `Pair` is also
opaque: live resources are routed inside the interpreter, never exposed as
ordinary PureScript values.

| Type | Public PS capabilities | Native behavior |
| --- | --- | --- |
| `Owned` | Explicit `finishOwned` only | Non-`Clone`, non-`Copy` owner; actual Rust destructor runs after consumption. |
| `Disposable` | `Drop` | Non-`Clone` owner; `drop` invokes its destructor immediately. |
| `Deep` | `Clone`, `Drop` | Actual `Clone` copies a `Vec` allocation; subsequent mutation is independent. |
| `SharedValue` | `Clone`, `Drop`, `Shared` | Actual `Clone` creates another `Arc` handle to one immutable payload. Aliasing is intentional. |
| External `Attachment` | `Drop`, explicit consuming operations | Separate FFI module supplies its own non-`Clone` owner and destructor. |

The PureScript classes are policies, **not automatic bindings to Rust traits**.
For example, every native owner here has Rust destruction, while `Owned` has no
public PS `Drop` capability because its API requires explicit finishing.
`Clone` plus `Drop` does not automatically grant `Shared`.

The generic operations include:

```purescript
clone :: forall a. Clone a => a -* Pair a a
drop :: forall a. Drop a => a -* Unit
fst' :: forall a b. Drop b => Pair a b -* a
twice :: forall a b. Clone a => (Pair a a -* b) -> a -* b
share :: forall a. Shared a => a -* Pair a a
```

`fst'` is K-like: it retains the first component and **executes** the discard
operation for the other one. `twice` is W-like routing through an allowed clone;
it is not an unrestricted duplicator. A conditional `Drop (Pair a b)` instance
also requires `Drop` for both components.

`Demo.purs` exercises the capabilities rather than merely declaring them:

```purescript
abandon = clone >>> tensor openOwned openDisposable >>> fst' >>> finishOwned

deep = openDeep
  >>> twice (tensor (addDeep 7 >>> finishDeep) finishDeep)
  >>> sumInts

shared = openShared >>> share >>> tensor finishShared identity >>> fst'
```

For input `10`, the deep-copy workflow returns `27`: the left copy becomes
`17`, while the right remains `10`. Native assertions additionally check that
their vector storage differs. The sharing workflow checks `Arc::ptr_eq` and
releases two handles but destroys only one payload. These are deliberately
different guarantees.

## A resource added outside the core library

`ForeignExample.purs` and `ForeignExample.rs` add `Attachment`, `attach`,
`appendByte`, `sizeAndClose`, and a conditional `Drop` instance. The core does
not mention `Attachment` or any of those operations.

The reusable extension mechanism is a trusted native instruction function
`fn(Datum) -> Datum` and an owned erased slot, `Box<dyn Any + Send + Sync>`.
The external implementation moves its non-`Clone` `Attachment` into and out of
that slot. Checked downcasts enforce the native representation at runtime.
There is no per-resource enum variant to add and no compiler change.

The current purust convention for a foreign `Sub` value uses
`Value::ClassShared(native_code(...))`. That shares an instruction description;
it does not wrap or alias the live `Attachment`. All resource acquisition
happens when `runInt` executes the description inside `Effect`.

`ExtensionDemo.purs` executes:

```purescript
runInt (attach >>> appendByte >>> sizeAndClose) 10
runInt (attach >>> drop >>> zero) 10
```

The results are `11` and `0`, with two acquisitions, one explicit close, one
explicit discard, and exactly two destructor calls. The external type also
fails the clone, share and double-consumption typing probes.

## Results and adversarial checks

All **21 typing cases** meet their expected outcome: **5 accepted**, including
one deliberately unsafe control that is never executed, and **16 rejected**.
The accepted cases include a visible-newtype coercion calibration and the
independent extension. Rejections cover missing capabilities, conditional
pair discard, double consumption, unrestricted lambda insertion, hidden
constructors/builders, nominal input/output coercions and resource escape.

Each executable passes in both native modes:

```text
LINEAR_CAPABILITIES_OK owned=2 disposable=3 deep_clones=1 deep_drops=3 shared_clones=1 shared_handles=2 shared_payloads=1 results=10,10,27,10,0
LINEAR_CAPABILITIES_EXTENSION_OK opened=2 closed=1 discarded=1 dropped=2 results=11,0
```

The first marker summarizes two owned resources acquired, finished and
destroyed; three disposable resources destroyed; two original deep resources
plus one real clone destroyed; and two shared handles releasing one payload.
Additional assertions establish that K-like disposal happened before the
following `finishOwned`, not merely at program exit. The same `Effect` value is
replayed to check that reusable descriptions acquire fresh resources.

## Scope and trust

This demonstrates that capability distinctions and an extensible trusted FFI
can be implemented **with a library and wrappers**, without changing PureScript.
It does not prove coverage of every Rust library or every future FFI need.

* Primitive signatures, native implementations and capability instances remain
  trusted. A dishonest FFI or `unsafeCoerce` can bypass the discipline.
* Only closed `Int -> Int` descriptions execute here. There is no general
  eliminator, unrestricted callback lift, or claim to implement the historical
  `runShared` API. `Shared` governs an explicit internal sharing operation.
* The extension slot currently requires owned `Any + Send + Sync + 'static`
  values. Borrowed data, thread-confined owners and asynchronous execution need
  appropriate additional interfaces; they are not established by this suite.
* Neither user-code lifetimes nor arbitrary Rust borrow rules are inferred.
  The erased native representation uses allocation and checked downcasts.
* `--threaded` tests compilation and execution in that runtime mode; these
  workflows do not themselves spawn concurrent threads. Error cleanup,
  cancellation and panic recovery are not exercised here.

This is an original effectful first-order implementation inspired by
[Phil Freeman's article](https://blog.functorial.com/posts/2017-08-05-Embedding-Linear-Lambda-Calculus.html)
and the conditional `Clone`, `Drop`, `Shared` API in
[`purescript-substructural` at `51f4c37`](https://github.com/nfgrusk/purescript-substructural/blob/51f4c37c80f196b7521542d60f6f428b6039949d/src/Data/Function/Sub.purs).
It does not execute or claim to port the historical JavaScript library.
