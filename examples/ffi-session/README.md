# FFI session protocol POC

A small PureScript library enforces an `Open -> Closed` protocol at compile time,
then runs it against a real, non-clonable Rust resource through the existing
`purust` backend. No compiler or runtime changes are required.

```purescript
shared = Session.then_ (Session.add 5) Session.inspect
program = Session.then_ shared Session.finish
action = Session.run 10 program
```

`Program before after` describes operations. Its constructor is hidden, and its
state parameters have nominal roles so `Safe.Coerce` cannot change the protocol.
`then_` requires adjacent states to match. `finish` changes `Open` to `Closed`;
`run` accepts only a complete `Program Open Closed`.

The Rust `Session` itself never crosses into PureScript. Only immutable plans
are shared. Each execution of `action` creates a fresh Rust session, executes the
plan, and calls `finish(self)` once. The example executes the same action twice
and reuses part of its plan in a third action. There is no consumed flag or
runtime double-use check for the native resource.

## Run

From the `purust` repository root, with the existing dependencies and built
`bin/purust.js` available:

```sh
node examples/ffi-session/run.mjs
```

Requires the TAST-producing `purs` fork, Node.js with `fs.globSync`, and Rust/Cargo.
The script discovers the local fork using the native bootstrap helper; set
`PURUST_PURS` (or `PURS`) to select a different executable. Cargo runs offline. Source compilation and
generated Cargo workspaces start in a fresh temporary directory each time.
Pass `--keep-output` to retain the complete generated workspaces.

The script checks nine rejected programs: double finish, alias reuse, read after
finish, repeated finish returned by a helper, unfinished execution, input/output state coercion,
constructor access, and access to the raw runner. It then generates and runs Rust in normal
and threaded modes. Both must produce three distinct sessions, the results
`17, 17, 25`, and exactly three creations, completions and drops. Threaded mode
checks compatibility with the backend's thread-safe representation; this example
does not launch concurrent actions.

Results and compiler diagnostics are written to `artifacts/report.json` and
`artifacts/commands.json`. Generated `Session` and `Demo` modules are retained in
`artifacts` for inspection; that directory is ignored by Git.

## Scope of the guarantee

This is a statically checked protocol for one privately owned session per run,
not general linear types for arbitrary PureScript values or a Rust borrow checker
for the FFI. `finish` seals the plan at the type level; the trusted Rust runner
performs the actual finalization at the end. Ordinary PureScript aliasing of a
plan remains legal and does not alias an open native session.

The public API has no raw handle, no unrestricted `run` of a fragment, no state
reset, and no arbitrary effect injection. The POC does not yet cover multiple
interacting resources, asynchronous callbacks, borrowed results, or passing an
existing externally owned handle into the DSL. Normal successful termination is
tested; exactly-once completion under panic, cancellation, or process termination
is not promised. As with other typed APIs, forged FFI or `unsafeCoerce` can violate
the contract.

`Session.rs` separates ordinary Rust resource code from the handwritten purust
adapter. Automatic parsing/generation of that adapter is a separate experiment.
The simple plan concatenation copies operations and is not a performance design.
