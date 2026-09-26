# ⚙️ purust

<img height="160" alt="purust" src="https://github.com/user-attachments/assets/2766a736-74ca-43db-aa50-6fa7d994c8d6" />

**An experimental PureScript-to-Rust backend.** `purust` compiles PureScript through a typed intermediate representation and emits a Cargo workspace containing a native executable, generated modules, and its runtime.

The backend is written in PureScript, with JavaScript support code, and runs on Node.js during compilation. The generated application runs as a Rust binary. Follow development in the [project devlog](https://discourse.purescript.org/t/leveraging-modern-low-level-a-rust-backend-for-purescript/5932/7).

## Features

- **Typed native code generation:** ADTs become Rust enums; typeclass declarations and typed expressions guide representation and specialization.
- **Optimization before Rust compilation:** a TAST-aware fork of `purescript-backend-optimizer` supplies inlining, dead code elimination, uncurrying, and tail-call transformations.
- **Rust FFI:** `.rs` implementations can call Rust libraries, with optional Cargo dependency declarations beside the FFI file.
- **Two ownership modes:** local reference counting by default, or atomic shared ownership with `--threaded`. The Rust `Aff` implementation uses Tokio in threaded mode.
- **Generated Cargo projects:** the backend writes manifests, module crates, runtime sources, and an executable entrypoint ready for Cargo.

## Benchmarks

The [Rust results in altbak.pub](https://github.com/0x000000000000000000001/altbak.pub#rust) are the reference benchmark baseline. They compare compiled PureScript with native functional and hand-written Rust implementations on deliberately stressful algorithms.

Consult that repository's commands, inputs, and recorded baseline when evaluating a compiler change. Results vary by workload, hardware, compiler version, and Cargo profile; the published core table measures sequential workloads and does not establish multi-core scaling or application-wide speedups.

## Getting started

### Prerequisites

You need:

- Node.js and npm. The pinned Spago 1.0.3 requires Node.js 22.5 or newer.
- A Rust toolchain with Cargo and a native linker. The hello-world example below was checked with Node.js 24.8.0 and Cargo/Rust 1.96.0; the repository does not declare a minimum Rust version.
- The [TAST-enabled PureScript compiler fork](https://github.com/0x000000000000000000001/purescript), available as `purs` when compiling application sources. An upstream `purs` binary with the same version number is not sufficient.
- The [optimizer fork](https://github.com/0x000000000000000000001/purescript-backend-optimizer) with the changes used by `purust` (the development checkout uses `edge-purust`), plus the local packages named below.

### Build the backend

The current build uses local checkout dependencies. A standalone `npm install` from GitHub does not establish those checkouts: the package's `prepare` script invokes a build against the paths in [spago.yaml](spago.yaml).

The compiler's checked-in configuration expects this layout:

```text
workspace/
├── purescript/                          # TAST compiler; also supplies bin/test fixtures
├── purescript-backend-optimizer-purust/  # TAST-aware optimizer checkout
├── gopurs/
│   ├── gopurs-st/
│   ├── gopurs-unsafe-coerce/
│   └── gopurs-assert/
└── purust/
    ├── purust/                          # this repository
    ├── purust-prelude/
    ├── purust-effect/
    ├── purust-console/
    ├── ...                             # other Rust library ports as needed
    └── hello-rust/                      # example application below
```

The three `gopurs-*` paths are dependencies of the compiler build. Application sources use the appropriate `purust-*` ports. The compiler's dependencies are defined in [spago.yaml](spago.yaml); the larger test runner's Rust library checkouts are listed in [tests/runner/spago.yaml](tests/runner/spago.yaml). Adjust the local paths if you use a different layout.

Once those checkouts exist, build the compiler from this repository:

```bash
npm install        # prepare builds the backend and bundles bin/purust.js
```

After compiler changes, rebuild with `npm run build`. The [bin/purust](bin/purust) launcher runs the bundle with the Node.js stack and heap settings used by the project.

### Compile and run an application

Create `hello-rust` alongside this repository and the three library ports in the layout above. Add `src/Main.purs`:

```purescript
module Main where

import Prelude
import Effect (Effect)
import Effect.Console (log)

main :: Effect Unit
main = log "Hello from PureScript and Rust!"
```

Add `spago.yaml`:

```yaml
package:
  name: hello-rust
  dependencies:
    - console
    - effect
    - prelude
workspace:
  packageSet:
    registry: 77.10.1
  extraPackages:
    prelude:
      path: ../purust-prelude
    effect:
      path: ../purust-effect
    console:
      path: ../purust-console
  backend:
    cmd: ../purust/bin/purust
    args: [--main, Main, --source, output, --out, output/purust_output]
```

From `hello-rust`, put the TAST compiler's executable directory on `PATH` and build:

```bash
export PATH="/absolute/path/to/tast-purs-directory:$PATH"
../purust/node_modules/.bin/spago build
cargo run --manifest-path output/purust_output/Cargo.toml
```

Expected output from the application:

```text
Hello from PureScript and Rust!
```

`purust` creates `output/purust_output/Cargo.toml` and `src/main.rs`, a crate for each generated module, and the `purust_core` and `perceus_ptr` runtime crates. Cargo resolves registry dependencies such as `mimalloc` and `fancy-regex`; threaded output also uses Tokio. No `cargo init` step is needed. Generated files are overwritten on regeneration.

The compiler reads **`output/<Module>/corefn.json` containing TAST metadata**. Although the representation is called `tcorefn`, this checkout's reader uses the filename `corefn.json`. The current fork exports `dataDecls`, `classDecls`, and a `typeTable`; check these fields when diagnosing a wrong compiler or stale build output. Recompile application sources after changing the PureScript compiler.

Each invocation reports monotonic elapsed times in milliseconds to stderr: TAST loading and sorting, preparation, optimization and generation, finalization and file emission, and the backend total. The total includes these phases; it excludes the preceding `purs` compilation and subsequent Cargo compilation. A failed phase and its enclosing total are marked `(failed)` before the error is propagated.

For a release build, use `cargo build --release --manifest-path output/purust_output/Cargo.toml`. The generated release profile currently sets `opt-level = 1` and retains debug information. Static linking and cross-compilation depend on the Rust target, linker, and FFI dependencies.

### Compiler options

Paths are relative to the application's working directory. Arguments can be placed in `workspace.backend.args`, or passed directly to the launcher:

```bash
../purust/bin/purust --source output --out output/purust_output --main Main
```

| Option | Default | Purpose |
| --- | --- | --- |
| `--main <Module>` | `Main` | Module exposing the executable's `main :: Effect Unit`. |
| `--source <directory>` | `output` | Read module directories containing typed `corefn.json` files. |
| `--out <directory>` | `output/purust_output` | Write the Cargo workspace. Its parent directory must exist. |
| `--ffi-dir <directory>` | `../` | Additional location for Rust FFI lookup; source-adjacent `.rs` files take precedence. |
| `--threaded` | Disabled | Use atomic ownership and thread-safe shared callbacks. Required for the Rust Aff runtime. |

The CLI currently has no help/version command or strict argument validation. Configure the options above in `workspace.backend.args`. To enable threaded output, add `--threaded` to that YAML list while retaining your existing arguments.

## Foreign function interface

Provide a `.rs` file beside the corresponding `.purs` source, or in a configured FFI search location. Functions use the module prefix with dots replaced by underscores, followed by the exported name. For example, `Native.add :: Int -> Int -> Int` is implemented as:

```rust
pub fn Native_add(a: i64, b: i64) -> i64 {
    a + b
}
```

The Rust file is included in the generated module crate. It must match the backend's ABI: concrete arguments can use native types, while polymorphic values, callbacks, and effects may use generated runtime types and wrappers. See the executable [Cargo FFI fixture](tests/tast/fixtures/ffi-cargo/CargoDependency.rs) for foreign types and a deferred effect. There is no automatic Rust-signature parser in the current compilation path.

### Cargo dependencies

A resolved `Module.rs` may have an adjacent `Module.rs.cargo.json`:

```json
{
  "schema": 1,
  "dependencies": {
    "num-bigint-dig": {
      "version": "=0.8.6",
      "default-features": false,
      "features": ["i128"]
    }
  }
}
```

The dependencies are emitted only in the Cargo crate of that resolved FFI,
including a module with foreign types but no foreign values. The sidecar follows
the resolved `.rs` path; it is not searched independently. Without it, generation
is unchanged. Removing it also removes its dependencies on the next generation.

Version 1 accepts stable, exact `=major.minor.patch` registry versions, lowercase
ASCII crate names, and optional boolean `default-features` and distinct ASCII
feature names. Omitted options retain Cargo's defaults. Unsupported fields,
paths/git sources, aliases, optional dependencies, version ranges/prereleases,
and malformed declarations are rejected. Compiler-owned dependencies
(`purust_core`, `perceus_ptr`, `fancy-regex`, `mimalloc`, `tokio`, `Purs_*`)
cannot be overridden; hyphen/underscore crate-name collisions are rejected.

The export uses ordinary registry dependencies, with no host paths added.
Cargo must resolve them in the build environment; pinning a direct dependency
does not replace Cargo.lock for its transitive dependencies.

Regression: `PURS=/absolute/path/to/the/tast-fork node tests/tast/ffi-cargo.mjs`.
It compiles fresh TAST, relocates exports and runs Cargo offline in both ownership
modes, so the fixture dependencies must already be available in the local cache.

### Concurrent Aff programs

Use the `purust-aff` library port and add `--threaded` to the backend arguments:

```yaml
workspace:
  backend:
    cmd: ../purust/bin/purust
    args: [--main, Main, --source, output, --out, output/purust_output, --threaded]
```

Keep the package set and required library overrides from your application configuration. When `Effect.Aff` is present in threaded output, the generated executable installs its runtime and waits for active fibers to finish. Default output uses the local microtask runtime.

Threaded code uses atomic ownership and requires shared callbacks to satisfy Rust's `Send + Sync` constraints. FFI captured by those callbacks must meet the same requirements. Tokio can execute work across multiple threads; throughput and scaling depend on the workload and are not guaranteed to be linear.

## Trying it on arrays

Array-heavy code is the first workload this backend was tuned for. Add the
`arrays` port to the hello-world project above and try:

```purescript
module Main where

import Prelude
import Effect (Effect)
import Effect.Console (log)
import Data.Array as Array

sumEvens :: Int -> Int
sumEvens n = Array.foldl (+) 0 (Array.filter (\x -> mod x 2 == 0) (Array.range 1 n))

main :: Effect Unit
main = log (show (sumEvens 900))
```

`spago.yaml` gains the `arrays` dependency and its local port:

```yaml
package:
  name: hello-rust
  dependencies:
    - arrays
    - console
    - effect
    - prelude
workspace:
  extraPackages:
    arrays:
      path: ../purust-arrays
    # prelude, effect, console as in the hello-world configuration
```

Build and run it as before. `Array.range`, `Array.filter` and `Array.foldl`
compose into a single native loop: the range stays virtual, the predicate and
the accumulator are monomorphized at the call site, the loop vectorizes, and
no intermediate array is allocated. `Array.any`, `Array.all`,
`Array.replicate` and `Array.length` join the same typed paths when their
arguments are statically known. Indexed or random access still goes through
reference-counted `Value` arrays, so those sites remain the slower ones.

## Running the benchmark column

The [altbak.pub](https://github.com/0x000000000000000000001/altbak.pub) Rust
column drives the generated Cargo project, so it expects the same checkout
layout: clone it next to this `purust` directory, with `spago` on `PATH` and a
working Cargo toolchain. From `altbak.pub`:

```bash
./bin/rust/run                # spago build + purust + cargo build --release + one measured run
./bin/rust/run --build-only   # stop after the build
./bin/rust/run --run-only     # re-run the existing binary; three runs give a median
```

Each run prints one line per benchmark and validates the expected outputs.
`Array Processing` is `src/Test/ArrayOps.purs` (`range` → `filter` → `foldl`);
`List Processing` and `Prime Sieve` exercise the backend on strict lists, and
`Array Indexing` (excluded from the published table) stresses width-based
array access.

## Development and testing

Build the compiler first. From this repository:

```bash
npm run test:codegen
PURS=/absolute/path/to/tast-purs npm run test:tast
```

These are code-generation and fresh-TAST regression suites. They require Rust tools; individual fixtures may also require sibling library ports and locally cached Cargo dependencies. See [tests/codegen](tests/codegen) and [tests/tast](tests/tast) for their scope.

The compiler fixture runner uses `purescript/tests/purs/passing` from the checkout layout above and the library ports in [tests/runner/spago.yaml](tests/runner/spago.yaml):

```bash
export PATH="$PWD/node_modules/.bin:$PATH"
export PATH="/absolute/path/to/tast-purs-directory:$PATH"
./bin/test SomeFixture.purs       # an existing fixture name or path
./bin/test                      # run the configured passing-test directory
./bin/test -c                   # reinstall/rebuild and clear runner caches first
```

Run these commands in a disposable test checkout: the runner replaces its `tests/runner/src` contents and clears generated output. Use the committed runner configuration; its fallback configuration generator contains legacy `gopurs-*` paths.

The sibling `purust-aff/bin/test --smoke` runs a small Aff scenario. Its `bin/test -c` rebuilds the compiler and runs Aff, Ref/AVar integration, fiber lifetime, and error-reporting checks.

## Architecture

1. [Main](src/Main.purs) loads the typed modules and their data/typeclass declarations through the optimizer fork.
2. The optimizer produces `BackendModule` values. [Purust.CodeGen](src/Purust/CodeGen.purs) and its helper modules generate Rust source using the preserved types.
3. The backend resolves Rust FFI, validates adjacent Cargo declarations, and emits module crates, runtime files, and the executable workspace.
4. Cargo compiles that workspace into the target binary.

## Current status and limitations

The backend and library ports are experimental. Targeted regressions and individual package suites do not establish support for every upstream PureScript test or library. Library compatibility depends on the available Rust FFI implementations; JavaScript FFI cannot run in the generated application.

Missing foreign implementations can currently produce fallback values or `unimplemented!()` bodies instead of an early error. Verify that every foreign import has a real Rust implementation before relying on application results.

Typed generation reduces boxing where supported, but the runtime still includes dynamic `Value` representations, reference-counted allocations, and closures. The runtime and some FFI use `unsafe` Rust; successful compilation alone is not proof of memory safety or full PureScript compatibility. The project does not promise stack-only execution, allocation-free code, or support for every library.

## License

MIT. See [LICENSE](LICENSE).
