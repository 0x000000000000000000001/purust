# Native callbacks without compiler changes

This experiment uses ordinary PureScript `Effect` and the existing Rust FFI.
It adds no compiler pass, ownership annotation or third-party dependency.

Run from the Purust repository:

```sh
node examples/linearity-lab/run.mjs --suite native-callbacks
```

The shared harness compiles the PureScript source, generates Rust, executes it
in both normal and threaded modes, and records commands, generated modules and
results under the ignored `examples/linearity-lab/artifacts/native-callbacks/`.
Every child command has a 60-second limit. No external service is needed.

## What is exposed

`Callbacks.rs` stores a real `Box<dyn FnOnce(...)>` that captures a `Session`
which implements neither `Clone` nor `Copy`. Moving that captured session to
`drop` makes the underlying closure one-shot. PureScript receives an opaque
`Once` handle and can invoke it with an ordinary `Int -> Effect Int` callback.

PureScript still accepts handle aliases and replay of the same `Effect`.
The wrapper moves the closure out of `Mutex<Option<_>>` before invoking it.
Only the first attempted invocation obtains the native closure. Later attempts
raise `once consumed`, including after a callback exception. Explicit discard
also drops an unused closure and its captured resource; repeated discard is
harmless. This is an at-most-once invocation contract, not a guarantee that an
invocation succeeds or ever occurs.

The mutable variant stores a real `Box<dyn FnMut(...)>` whose captured session
is modified through a `&mut self` method between calls. This forces capture of
the whole resource; directly accessing a `Copy` field could capture only that
field. Intermediate Drop counters check resource retention before release,
including after a callback exception. It supports repeated calls and repeated execution
of the same PureScript `Effect`. An exclusive temporary lease moves the closure
out of its mutex and marks the handle `Running`. Callback code executes without
holding the mutex. Reentrant invocation or close raises `mutable callback busy`
instead of blocking. The lease's Rust `Drop` restores the closure on both return
and exception. State mutations made before a callback error remain visible;
there is no rollback. Explicit close drops the captured resource exactly once.

The public signatures are in `Callbacks.purs`; `Demo.purs` is the actual caller.
Both kinds of user callback have the same ordinary PureScript function type.
This does not establish that an arbitrary PureScript closure is itself `FnOnce`
or `FnMut`, or prevent it from copying values and performing other effects.

## Executed probes

| Probe | Expected result |
| --- | --- |
| `FnOnce` successful callback | Native captured value reaches PureScript and returns 11. |
| Aliased handle and replayed invocation `Effect` | Accepted by PureScript; rejected at runtime after the first call. |
| Throwing `FnOnce` callback | Original exception propagates; captured resource drops; retries are consumed. |
| Discard without invocation | Captured resource drops; repeat discard does not drop again. |
| Reentrant `FnOnce` call | Nested attempt returns consumed; outer call completes. |
| Stateful `FnMut` calls and replay | State progresses 0 → 2 → 4. |
| Throwing `FnMut` callback | Original exception propagates; the next call observes state 7. |
| Reentrant `FnMut` invocation and close | Both return busy; later invocation remains usable and reaches 10. |
| Repeated close and unused mutable closure | Resources drop once; invocation after close is rejected. |
| Final native counters | 6 created, 6 dropped, 3 one-shot calls, 6 mutable calls. |

`rust-controls.rs` supplies separate native compiler controls: valid `FnOnce`
and `FnMut` execute and release their resources; calling an owned `FnOnce`
twice is rejected with `E0382`; requiring `Fn` from a mutating closure is
rejected with `E0525`. These controls concern Rust code directly, not a new
PureScript rejection rule.

The executed contention probe is synchronous reentrance. Both backend modes
are checked, but this suite does not claim a simultaneous multi-thread race
test. Callbacks use synchronous `Effect`; `Aff` cancellation is outside this
suite. Resource destruction is verified at explicit release and unwind, not
at a presumed PureScript garbage-collection or last-use point.
