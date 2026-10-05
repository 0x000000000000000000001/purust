# Automatic contracts and an additional compile-time pass

This experiment separates signature extraction from usage checking. It does not
implement a transparent, general Rust FFI or change the production compiler.

```sh
node examples/linearity-lab/run.mjs --suite automatic
```

## What executes

1. A real Rust parser, [`syn`](https://docs.rs/syn/2.0.119/syn/), reads `native.rs`.
   For the supported free functions, it distinguishes `Session`, `&Session`,
   `&mut Session`, integers, and unit. It emits ownership metadata and generates
   the corresponding PureScript foreign declarations in a temporary directory.
   The generated declarations must match `Native.purs`.
2. The actual TAST compiler accepts all twelve PureScript examples. Their
   ordinary `Effect` signatures contain no static consumption restriction.
3. `check-tast.mjs` reads those real TAST files. A small abstract interpreter
   tracks resource identity through aliases, effects, local helpers and replay.
   It distinguishes building an action from executing it. Executing `open`
   twice allocates two abstract identities; executing `finish` twice on one
   identity is rejected.
4. Independent Rust controls are compiled with `rustc`: a valid native program
   executes, a double move gives `E0382`, and overlapping mutable borrows give
   `E0499`. These manually written controls confirm native Rust rules; they are
   **not** generated from PureScript and do not validate a lowering pass.

| Supplementary check | Outcome |
| --- | --- |
| Borrow, mutate, inspect, consume | Accepted |
| Allocate twice by replaying one allocation effect | Accepted, two identities |
| Drop an unused resource | Accepted: Rust ownership is affine |
| Borrow two distinct resources in one call | Accepted |
| Consume through two aliases | Ownership error |
| Replay the same consuming effect | Ownership error |
| Repeat a helper capturing one resource | Ownership error |
| Read after consumption | Ownership error |
| Pass one resource as shared and mutable arguments together | Ownership error |
| Return an action capturing a resource | Unsupported escape |
| Safe conditional depending on a native result | Unsupported syntax |
| Discard the result of an unknown foreign call | Unsupported call |

The last three outcomes do not mean those programs are all inherently unsafe.
They mean this checker cannot certify them. It rejects unknown globals even
inside unused `let` bindings. The parser also rejects borrowed return values and
nested references (`&&Session`, `&mut &Session`) instead of flattening them.

## What is still manual

The resource name and the meaning of `open` are part of this experiment's trusted
contract. A return type by itself does not prove freshness, absence of internal
sharing, or the behavior of callbacks. The checker explicitly permits `open`
as the fresh constructor for the supplied Rust implementation. It does not infer
`Clone`/`Copy` properties or function effects by inspecting arbitrary Rust bodies.

Only immediate, synchronous borrows of this one resource type are supported.
Borrowed results, lifetimes, traits, generics, methods, async operations, resource
containers and callbacks need richer contracts. Type and method resolution is
not supplied by a syntax parser. The extractor rejects unsupported signatures
in the tested subset; it is not a complete Rust API scanner.

The supplementary checker understands direct `Effect` bind/pure, local
nonrecursive lets/functions, literals, and the configured native calls. It has
no general control-flow join, intermodule analysis, recursion proof, higher-order
effect model, or mutation/alias analysis for stored resources. Exported ownership
and action escape are rejected. It checks one selected `program` entry point,
not every function in an application. It is an executable research probe, not a
soundness proof or a production-ready verifier.

No `Native.rs` adapter is implemented for the generated PureScript declarations,
and these particular PureScript programs are not run through purust. Actual
PureScript-to-Rust executions are in the other three suites. This experiment
tests automatic **contract extraction and extra diagnostics**, not end-to-end
automatic wrapper generation.

The pass computes its own symbolic identities from the selected TAST. It never
treats local usage counts or last-use markers as proof of unique ownership.
Integrating a real pass would require preserving its conclusions across backend
transformations or analysing the relevant final IR again.

The caller uses ordinary PureScript syntax here, but the compiler/tooling effort
is substantially higher than for the library encodings. The generated foreign
types alone are insufficient: the additional checking step is essential.

Reports, extracted metadata, generated declarations, and command diagnostics are
written to `../artifacts/automatic/`.
