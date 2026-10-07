# Library APIs for Rust FFI: follow-up experiments

The practical question is whether a library and trusted Rust adapters can expose
useful native APIs safely, without changing the PureScript compiler. It does not
require reproducing Rust's entire ownership system in ordinary PureScript code.

**The tested APIs work without a compiler or backend change.** Conditional
substructural capabilities, scoped indexed effects and checked ordinary handles
provide complementary solutions. An external FFI module also adds its own
non-`Clone` resource without changing the library core for that resource.
This supports developing a reusable library; it is not proof of universal FFI
coverage or a finished integration of the historical `purescript-substructural`.

## Fresh results

These runs use the existing TAST compiler, then purust and native Rust. Every
native program runs in both normal and threaded modes. The
[results snapshot](ffi-library-results.json) records tool identities, source
hashes, diagnostics and native output. Accepted counterexamples and deliberately
unsafe controls are identified; acceptance alone is not a safety guarantee.

| Suite | Accepted PS cases | Expected PS rejections | Native executions |
| --- | ---: | ---: | ---: |
| New: [conditional capabilities](capabilities/README.md) | 5 | 16 | 4 |
| New: [borrowed views](borrowed-views/README.md) | 2 | 12 | 2 |
| New: [native callbacks](native-callbacks/README.md) | 1 | 0 | 2 |
| Rerun: [combinators](combinators/README.md) | 6 | 23 | 2 |
| Rerun: [regions](regions/README.md) | 8 | 5 | 2 |
| Rerun: [indexed capabilities](indexed/README.md) | 7 | 21 | 4 |
| **Total** | **29** | **77** | **16** |

Thus the follow-up adds **36 typing cases** and reruns 70 existing ones. All 106
match their expected outcomes. Three separate Rust controls also pass: one valid
callback program, rejection of a second owned `FnOnce` call (`E0382`), and
rejection of a mutating closure where `Fn` is required (`E0525`). The other
original lab suites were not rerun for this follow-up.

## What the new examples establish

**Conditional capabilities.** Opaque `Sub` arrows with nominal roles permit
cloning or discarding only through the corresponding capability. Missing
capabilities, double consumption, constructor access and coercion attempts are
rejected by PureScript. Native assertions distinguish a deep clone with
independent mutable storage from two `Arc` handles sharing an immutable payload.
Discarding a resource actually invokes its destructor before the next operation.

The [external FFI example](capabilities/ForeignExample.purs) supplies a new
`Attachment` type, consuming operations and a `Drop` instance. Its Rust module
uses a generic extension slot rather than adding a resource-specific variant to
the core. The caller composes ordinary library operations:

```purescript
runInt (attach >>> appendByte >>> sizeAndClose) 10
runInt (attach >>> drop >>> zero) 10
```

These return `11` and `0`; both acquired resources are destroyed exactly once.
The prototype still executes only closed `Int -> Int` descriptions. Its native
extension slot requires owned `Any + Send + Sync + 'static` values and uses
checked downcasts. Broader execution boundaries and thread-confined resources
need further library interfaces.

**Scoped borrowed views.** The indexed API rejects mutation while a view is
borrowed, direct escape, deferred operations escaping the scope, and attempts to
reuse an old view in a new borrow. The caller does not write phantom state names;
the library infers the state transitions through qualified `B.do` notation.
An existential package can be stored, but its hidden view cannot be reactivated
through the public API.

The Rust wrapper carries an owner, range and generation. A read borrows a real
`&[u8]` under a mutex and returns a scalar; no native lifetime crosses into
PureScript. Native tests additionally reject stale views, closed buffers and
mutation from another thread during a borrow. This simple API is conservative:
even nested shared borrows are rejected. It does not yet model arbitrary native
references, multiple independent buffers or async borrows.

**Ordinary callbacks.** Real native `FnOnce` and `FnMut` closures capture
non-clonable resources and invoke ordinary PureScript `Int -> Effect Int`
callbacks. PureScript accepts aliases and replayed `Effect` values; the Rust
wrapper therefore enforces consumed, busy and closed states dynamically.
Tests cover callback exceptions, reentrancy, replay and explicit release.
Intermediate destruction counters prove that the captured resource remains
alive until its intended release; all six resources are ultimately destroyed.
The mutable callback remains usable after an exception, preserving mutations
already performed. This suite tests synchronous reentrancy, not simultaneous
thread races or `Aff` cancellation.

## Implication for a reusable FFI library

The experiments establish three useful building blocks: conditional operations
on owned values, typed scopes/protocols, and native runtime guards for ordinary
handles. FFI authors can choose the appropriate public contract and implement
the native operations behind it. The compiler does not automatically infer
these contracts from Rust signatures.

The older region counterexamples remain important: a rank-2 `withFoo` callback
returning unrestricted `Effect` can let usable deferred actions escape. Hiding
types alone is insufficient; the scoped effect API or native guard must preserve
the intended contract. Likewise, the trusted Rust primitive implementations and
capability instances must implement what their PureScript signatures promise.

We have not encountered a need to change the compiler for these APIs. Coverage
of arbitrary Rust libraries, general async/cancellation, native lifetime-bearing
results and ergonomic unrestricted composition remains unproven. These are
specific future validation targets, not evidence that a library approach cannot
work. No performance or zero-cost claim is made.

## Reproduction

From the purust repository, with the existing local compiler, built backend and
cached dependencies:

```sh
node examples/linearity-lab/run.mjs --suite capabilities
node examples/linearity-lab/run.mjs --suite borrowed-views
node examples/linearity-lab/run.mjs --suite native-callbacks
node examples/linearity-lab/run.mjs --suite combinators
node examples/linearity-lab/run.mjs --suite regions
node examples/linearity-lab/run.mjs --suite indexed
```

Cargo runs offline. Each typing probe receives fresh output, and expected
rejections must match both the diagnostic code and the test module. Detailed
commands, generated Rust and reports remain under ignored `artifacts/`.
Successful temporary build workspaces and obsolete failed probes were removed.
The compiler executable and backend bundle hashes were unchanged throughout;
all source additions and edits are confined to this lab.
