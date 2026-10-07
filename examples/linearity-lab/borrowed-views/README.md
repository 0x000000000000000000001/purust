# Scoped borrowed views, with a PureScript library and native wrappers

This experiment requires no frontend or backend changes. It combines a hidden
region-indexed effect with a fresh borrow token and a small native adapter.
It is a deliberately narrow buffer API, not a general Rust lifetime importer.

```purescript
program = B.withBuffer "ab" \buffer -> B.do
  first <- B.withView buffer B.checksum
  B.append buffer "c"
  next <- B.withView buffer B.checksum
  B.pure (first + next)
```

The buffer and borrow tokens are inferred. The caller uses qualified `B.do`
and `withView`; they do not name phantom types or manually finish the borrow.
Operations that preserve an active borrow can run repeatedly. Handles remain
ordinary shareable PureScript values; capabilities constrain their operations.

## What the types check

`Ix scope before after a` is opaque. `append` requires `Ready`, while `checksum`
requires `Borrowed view`. `withView` introduces a fresh `view` token and confines
its callback to that borrow state, then returns to `Ready`. `withBuffer` introduces
a fresh region. All scope and state parameters have nominal roles. There is no
public unlift to `Effect`, no `MonadEffect` instance, and no general action runner.

The suite includes:

| Case | Expected result | Meaning |
| --- | --- | --- |
| `Valid` | Accept | Borrow, read twice, finish scope, mutate, borrow again. |
| `MutationDuringBorrow`, `SavedMutation` | Reject | Both immediate and previously saved mutations require `Ready`. |
| `DirectEscape`, `BufferEscape` | Reject | Directly returned handles retain fresh scope/token. |
| `DeferredClosure` | Reject | A closure's indexed read action still carries scope and token. |
| `Existential` | Accept | A handle can be stored behind an existential; no blanket no-escape claim. |
| `ReviveExistential` | Reject | A hidden old region/token cannot be used in a new scope. |
| `ReborrowOldView` | Reject | A fresh borrow does not reactivate the previous view, even in the same region. |
| `NestedBorrow` | Reject | This API intentionally forbids overlapping shared borrow scopes too. |
| `CoerceState`, `CoerceView` | Reject | `Safe.Coerce` cannot erase the nominal state/token requirements. |
| `RawRunner` | Reject | Clients cannot unwrap the hidden action constructor. |
| `ConcurrentEffect` | Reject | A scheduler taking ordinary `Effect` cannot run an indexed operation. |

Rejections are checked against the compiler's diagnostic code **and the target
module**. An unrelated missing dependency or invalid supporting API does not count.
The existential fixture is separately checked for acceptance.

## What actually crosses the native boundary

The Rust buffer owns a `Vec<u8>`. A native view contains an `Arc` owner reference,
range and generation number. It contains **no stored `&[u8]` or forged lifetime**.
For each checksum, Rust locks the cell and borrows the selected `&[u8]` directly
from that vector. The code checks that the slice pointer is the owner's pointer;
no buffer/String copy is made by the read. Only the integer checksum is returned
to PureScript. Initial allocation, reference-counted handles and mutex acquisition
still cost work; this experiment makes no speed claim.

This is zero-copy access *inside a native call*, using a checked owner/range view.
It is not a Rust borrow whose compile-time lifetime crosses arbitrary PureScript
code. `append` can reallocate the vector after the view's scope ends. Stale handles
cannot read after that transition, even when another view is subsequently opened.

The native adapter retains a dynamic backstop: active-borrow status, generation and
closed-owner checks. The effect runner closes the byte owner on scope exit; inert
existential wrappers may survive without retaining the bytes. RAII guards release
the borrow/owner on Rust unwinding as well, though the suite does not claim to test
all PureScript exception paths or asynchronous cancellation.

`Main` executes the actual PureScript program through TAST and purust twice. Rust
checks `(initial checksum, after append) = (195, 294)` through the final result,
and counts two buffers created/closed, six reads and two mutations. Replaying the
outer `Effect` opens a new buffer.

A separate native adversarial check deliberately bypasses PureScript's indices:
mutation during an active view, a second simultaneous view, stale read after scope
exit, stale read after a new generation, and read/mutation after owner closure
all return explicit internal errors. A real Rust worker also attempts mutation
during the active borrow and is refused. These are **runtime checks**, not extra
static guarantees attributed to PureScript. The production-style FFI entry points
panic if this internal contract is violated; a library intended for public use
could expose typed errors instead.

## Reproduce

From the purust repository root:

```sh
node examples/linearity-lab/run.mjs --suite borrowed-views
```

Validation on 2026-10-06: all 14 typecheck cases passed (2 accepted, 12
rejected), and both native execution modes emitted `BORROWED_VIEWS_OK`.

The existing lab harness compiles the fixtures with the local typed PureScript
fork, generates Rust with purust, then runs Cargo offline in both normal and
threaded modes. No service, network dependency, or handwritten substitute for the
PureScript executable is needed. It uses the repository's existing native package
sources and dependency cache. The runtime test marker is `BORROWED_VIEWS_OK`.

Detailed diagnostics, commands, tool versions, backend hash and generated Rust
are written to `../artifacts/borrowed-views/`. Failed scratch workspaces are retained
by the shared runner for diagnosis; successful workspaces are automatically removed.

## Practical boundary

This demonstrates a useful library-only route for a scoped, synchronous API with
scalar or owned results. The application stays small, but the API author must
provide these signatures and trust the wrapper implementation. They are not
inferred automatically from arbitrary Rust signatures.

One buffer occupies one region's state machine. Multiple simultaneously active
resources, nested shared borrows, disjoint mutable slices, returned native
references, callbacks that outlive a borrow, and arbitrary asynchronous work need
a richer API or a different representation. The rejected nested shared borrow is
a concrete ergonomic restriction compared with Rust. The absence of `liftEffect`
is deliberate; concurrency/callback combinators would need their own reviewed
contracts rather than a general escape hatch. `unsafeCoerce`, untrusted FFI and
nontermination are outside the static contract.

This is a custom combination of the indexed-effect and region patterns already
explored in `../indexed/` and `../regions/`. It does not claim that historical
indexed-monad or session libraries already supply this native buffer API.
