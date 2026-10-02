# ⚙️ purust

<img height="160" alt="purust" src="https://github.com/user-attachments/assets/2766a736-74ca-43db-aa50-6fa7d994c8d6" />

**An experimental PureScript-to-Rust backend.** `purust` compiles PureScript through a typed intermediate representation and emits a Cargo workspace containing a native executable, generated modules, and its runtime.

The backend is written in PureScript and can run on Node.js or be bootstrapped into an experimental native Rust executable. The generated application runs as a Rust binary. Follow development in the [project devlog](https://discourse.purescript.org/t/leveraging-modern-low-level-a-rust-backend-for-purescript/5932/7).

## Features

- **Typed native code generation:** ADTs become Rust enums; typeclass declarations and typed expressions guide representation and specialization.
- **Optimization before Rust compilation:** a TAST-aware fork of `purescript-backend-optimizer` supplies inlining, dead code elimination, uncurrying, and tail-call transformations.
- **Rust FFI:** `.rs` implementations can call Rust libraries, with optional Cargo dependency declarations beside the FFI file.
- **Two ownership modes:** local reference counting by default, or atomic shared ownership with `--threaded`. The Rust `Aff` implementation uses Tokio in threaded mode.
- **Generated Cargo projects:** the backend writes manifests, module crates, runtime sources, and an executable entrypoint ready for Cargo.

## Benchmarks

The [Rust results in altbak.pub](https://github.com/0x000000000000000000001/altbak.pub#rust) are the reference benchmark baseline. They compare compiled PureScript with native functional and hand-written Rust implementations on deliberately stressful algorithms.

Consult that repository's commands, inputs, and recorded baseline when evaluating a compiler change. Results vary by workload, hardware, compiler version, and Cargo profile; the published core table measures sequential workloads and does not establish multi-core scaling or application-wide speedups.

The [2026-10-02 TAST benchmark](https://github.com/0x000000000000000000001/altbak.pub/blob/main/docs/benchmark-results/2026-10-02-rust-json-typed-ast.md)
measures `purust-aff` backend compilation at **6,181 ms JS / 5,399 ms native**
(median of five rotating rounds, native at 4 PBO + 4 codegen workers). Native takes
**0.87× the JavaScript time**, a **12.7% reduction** on this workload. The fourth
lot reduces native time by **2.5%** against its same-campaign control, **5,540 →
5,399 ms**. On the separate 238-module gopurs-aff corpus, an extended 21-pair
confirmation gives **5,342 → 5,189 ms (−2.9%)**; the report also retains an
initial adverse campaign and the investigation of speculative PBO variability.
The isolated JSON → TAST path improves **18.3–19.6%**. Every generated output
matches exactly; the installed, self-rebuilt stage 2 passes the full Aff suite.

The [preceding pipeline campaign](https://github.com/0x000000000000000000001/altbak.pub/blob/main/docs/benchmark-results/2026-10-02-purust-aff-pipeline-compilation.md)
records the third lot's **27.5%** controlled native gain with its own samples.

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
npm run build:native
```

The [bin/purust](bin/purust) launcher and the npm `purust` command use
`bin/purust-native` by default. After compiler changes, rebuild it with
`npm run build:native`. To select the Node backend explicitly, rebuild its
bundle with `npm run build` and run `PURUST_JS=1 ./bin/purust ...`.

### Native compiler bootstrap

```bash
npm run build:native
# Select the TAST compiler explicitly:
PURUST_PURS=/absolute/path/to/typed/purs npm run build:native
# Retain the generated Rust workspace and build logs:
npm run build:native -- --keep-workspace
# Rebuild with the native compiler and install the validated second generation:
npm run build:native -- --self-host --keep-workspace
```

This compiles the PureScript sources of `purust`, PBO and their dependencies
into **`bin/purust-native`**. It requires the toolchains above and the sibling
`purust-*` library checkouts. The script rebuilds the Node backend, creates an
isolated Spago workspace using those Rust library ports, compiles fresh TAST,
generates Rust with the Node backend, and runs `cargo build --release` with
`profile.release.opt-level=3` and `profile.release.lto=false`. Disabling LTO
avoids passing Rust 1.96's LLVM 22 bitcode
to an incompatible Apple linker when linking the compiler's large archives.
`tools/embed-native-runtime.mjs` embeds the canonical runtime sources in the
native compiler during the build.

`PURUST_PURS` overrides discovery of the newest compiler executable under
`../../purescript/.stack-work/dist/*/*/build/purs/purs`. Every CoreFn module is
checked for `typeTable`, `dataDecls` and `classDecls` before Rust generation.
`PURUST_NATIVE_TMPDIR` selects the parent directory for temporary workspaces.
`PURUST_NATIVE_OUTPUT` selects an alternative executable destination, and
`PURUST_NATIVE_OPT_LEVEL=1|2|3` overrides the compiler's optimization level.
Failures retain the workspace and logs, and the installed binary is replaced
only after a successful Cargo build. Interrupts also stop child processes.

The executable accepts the same backend arguments:

```bash
./bin/purust-native --source output --out output/purust_output --main Main
npm run test:native -- --keep-workspace
```

The native smoke test creates fresh TAST, compares Node/native Rust and Cargo
files byte for byte, then builds and executes the generated application.
`PURUST_NATIVE` can select another compiler binary for this test.
The initial macOS arm64 validation on 2026-10-01 covered 152 TAST modules and
312 identical generated files; the compiled ADT/record/array fixture printed
`PURUST_NATIVE_OK 42`.

`--self-host` closes the loop automatically: stage 1 generates Rust from the
compiler's own TAST, its sources and manifests are compared byte for byte with
the Node output, Cargo builds stage 2, and that compiler runs the fresh-project
smoke test. The script then atomically installs stage 2 as `bin/purust-native`.

To perform these steps manually, retain the bootstrap workspace, change into
it, and run the installed native compiler on the same TAST:

```bash
/absolute/path/to/purust/bin/purust-native --source output --out rust-stage2 --main Main --threaded
diff -r --exclude=target --exclude=Cargo.lock rust rust-stage2
cargo build --release --config profile.release.lto=false --config profile.release.opt-level=3 --manifest-path rust-stage2/Cargo.toml
# Check that this second-generation compiler can build another project:
PURUST_NATIVE="$PWD/rust-stage2/target/release/purust_output" \
  npm --prefix /absolute/path/to/purust run test:native
```

The comparison checks the emitted sources and manifests. Debug information can
contain different build paths, so it does not require identical binary hashes.

On macOS arm64 (2026-10-01), native generation of the full compiler from 448
TAST modules produced 904 Rust sources and Cargo manifests identical to Node's
output. Cargo then built the second-generation compiler successfully in 168.6
seconds. Stage 2 passed the fresh-project smoke test: 152 TAST modules, 312
identical generated files, and the executable result `PURUST_NATIVE_OK 42`.
This validates the complete backend/PBO self-reconstruction loop.

The third 2026-10-02 validation, with **4 PBO + 4 codegen workers**, covers
**453 TAST modules, 282,610 types and 914 byte-identical Rust sources/manifests**.
The measured Node-built stage 1 was checked against the final JS bundle before
self-reconstruction. Cargo built stage 2 at optimization level 3 without LTO,
and stage 2 passed the independent 152-module, 312-file smoke test with
`PURUST_NATIVE_OK 42`, followed by the complete Aff suite.

The fourth validation retains these same module/type/file counts after adding
native TAST array and annotation decoding. It also checks **110,909 annotations**
against the generated PureScript reference, including errors, native numeric
representations, ownership and type sharing. Stage 2 is measured separately on
both frozen Aff corpora before installation.

Native generation in the initial 2026-10-01 run took 93.6 seconds with a peak physical memory
footprint of 861 MiB (`/usr/bin/time -l`; maximum RSS 910 MiB). Node generation
of the same input took 32.8 seconds. These are single-run observations with the
then-current threaded release profile (`opt-level = 1`, LTO disabled), not evidence
of a native speedup.

The native backend and optimizer execute without Node. The `purs` frontend
produces TAST, and Cargo compiles the generated application. The bootstrap
uses `--threaded` for the compiler's Aff and system libraries; the native
compiler still supports both local and threaded application output.

Native bootstrapping is experimental. PBO's native implementation cache holds
immutable modules for one build, without the JavaScript cache's disk spill or
byte budget. The unused legacy BackendModule JSON cache misses on reads and
rejects writes; V8/Go allocation-profile output is unavailable in Rust.
Native speedups must be measured on representative projects and are not
implied by successful self-compilation.

The native compiler defaults to a worker budget of **at most 8**, capped by the
available CPU count. `PURUST_PBO_JOBS=1..64` overrides this budget. By default,
native codegen reserves half the budget, up to 4 slots: on an eight-slot host,
**4 PBO workers and 4 codegen workers** share the work. The Node backend defaults
to sequential optimization and generation.

`PURUST_CODEGEN_JOBS=1..64` overrides generation concurrency, capped to leave at
least one optimizer slot. At 1, generation runs on the coordinator and PBO uses
the full budget; `PURUST_PBO_JOBS=1` makes both phases sequential. Generation
returns immutable results through a bounded queue, with publication in module
order. Module visibility and directives remain rank-ordered, and worker failures
cancel and join remaining jobs before returning. `PURUST_JOBS` separately
controls TAST file loading (default 1).

For isolated comparisons, retain a snapshot from the compilation benchmark and
use `node tools/compare-native.mjs SNAPSHOT RESULT_JSON LABEL=EXECUTABLE ...`.
A variant may instead name a JSON file containing `binary` (relative to that
file) and `env`, for example `{"binary":"compiler","env":{"PURUST_PBO_JOBS":"4"}}`.
The tool checks all frozen hashes, compares every generated source/manifest,
records phase times and peak RSS, and rotates the first variant each round.
`PURUST_BENCH_RUNS` sets the number of measured rounds (default 5).
Native AVL operations can be tested against the generated PureScript reference
using `node tools/test-native-maps.mjs /path/to/generated/compiler/rust`.
Native TAST array/annotation decoding can be compared with its PureScript
reference using `node tools/test-native-tast.mjs /path/to/generated/compiler/rust
/path/to/frozen/corefn-output`. This checks error precedence, callback counts,
UTF-16 strings, ownership and shared types, and requires every annotation in
the valid corpus to use the native fast path. The corpus may also be the packed
`JsonTypedAst` diagnostic JSON file.
`node tools/test-emission.mjs` checks bounded generation, ordered publication
and error cleanup in a freshly compiled native application; `PURUST_NATIVE`
selects an isolated compiler executable for this check.

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
| `--no-json-schemas` | Disabled | Disable generated Argonaut DOM/text decoders for differential checks. |
| `--no-json-layouts` | Disabled | Keep ordinary record carriers in generated JSON decoders for representation comparisons. |
| `--no-json-arrays` | Disabled | Keep boxed array elements in generated JSON decoders for representation comparisons. |

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
