# purust

<img height="160" alt="Screenshot 2026-08-21 at 23 20 53" src="https://github.com/user-attachments/assets/2766a736-74ca-43db-aa50-6fa7d994c8d6" />
<br />
<br />

_Experimental WIP. You can [find a complete devlog here](https://discourse.purescript.org/t/leveraging-modern-low-level-a-rust-backend-for-purescript/5932/7)._ 

A super-optimized **PureScript-to-Rust compiler**, entirely written in PureScript, leveraging Rust's **blazing-fast execution**, **memory safety**, **zero-cost abstractions** and **huge ecosystem**. 

`purust` leverages an enriched `tcorefn` (Typed CoreFn) representation to compile your pure business logic into robust, modern Rust code. It seamlessly integrates into your existing PureScript workflow as a custom backend.

## Why Rust?

While the broader JS ecosystem has heavily leaned towards TypeScript, many backend services, systems programming tasks, and infrastructure tools rely heavily on Rust for its **raw performance**, **memory safety** (without a Garbage Collector), and **deployment simplicity** (single static binaries).

`purust` aims to provide a bridge for developers who want the elegance and strict typing of a purely functional language like PureScript, while benefiting from Rust's massive ecosystem. It opens a door for those who want to compile their pure business logic into a highly optimized, safe, zero-dependency static binary that can run anywhere.

## Why a new Rust backend?

The `purust` project is largely inspired by previous efforts to compile PureScript to native targets. Reading through the discussions and challenges raised by users over the years, it became clear that the ecosystem has evolved drastically. This evolution unlocked new architectural paradigms that make building a completely new Rust backend highly relevant today:

### 1. The optimizer & bootstrapping
While previous native compilers were often written in Haskell and parsed raw `CoreFn`, `purust` is written 100% in PureScript. It integrates directly with the [`purescript-backend-optimizer`](https://github.com/aristanetworks/purescript-backend-optimizer). This allows the compiler to instantly benefit from classical optimizations such as aggressive uncurrying, magic-do, and Tail Call Optimization (TCO) at the AST level. The `purust` compiler can then strictly focus on translating this highly-optimized AST into idiomatic, performant Rust code. Being built in PureScript also ensures it remains fully accessible to anyone in the ecosystem (installable via `spago` and `npm`).

### 2. Native memory layout for Rust
For `purust`, the runtime relies on native Rust concepts. It uses `enum` (tagged unions) for ADTs, and leverages zero-cost abstractions, avoiding unnecessary heap allocations (boxing) whenever possible. This ensures that dynamic operations stay mostly on the stack, providing predictable and unparalleled performance.

### 3. TAST: Breaking the performance ceiling
To reach raw Rust speeds, `purust` consumes an enriched `tcorefn.json` (Typed CoreFn). This custom format preserves the deep structural typing information and the exact memory layout of ADTs that standard `corefn` strips away. Combined with partial monomorphization, this allows the compiler to generate idiomatic, statically typed Rust code end-to-end, unlocking massive performance gains.

### 4. Zero boilerplate FFI
One of the pain points with FFI in alternative backends is the boilerplate (manual boxing/unboxing, currying). `purust` features a WebAssembly AST parser (`ffi_gen.wasm`) that analyzes your `.rs` FFI files on the fly. You can write perfectly flat and strongly typed Rust functions. The generated bridge takes care of all the uncurrying, type conversions, and Effect flattening under the hood, making FFI development feel 100% native.

### 5. Up-to-date with modern PureScript & Rust
`purust` aims to be fully aligned with the current v0.15+ ecosystem (and v0.16+ soon). It takes full advantage of modern Rust, including its powerful type system and advanced concurrency primitives.

### 6. Native Parallelism behind Aff
Historical hurdles involved mapping PureScript’s asynchronous monad (`Aff`) without introducing massive overhead. Today, the game has changed. `purust` maps `Aff` to async Rust (e.g. `tokio` tasks), bringing true, shared-memory parallelism to PureScript. A heavy CPU-bound parallel workload naturally distributes across your CPU cores, scaling linearly.

## How to use

If you wish to configure an existing project, `purust` acts as a drop-in backend for the Spago build system.

1. **Install the `purust` backend compiler:**
   You can install the compiler directly from GitHub. NPM will automatically compile it in the background during installation.
   ```bash
   npm install --save-dev github:0x000000000000000000001/purust
   ```

2. **Manage Core Library Overrides (`spago.yaml`):**
   Because standard PureScript libraries use JavaScript FFI, you must override them with their `purust-*` counterparts. Keep using the official PureScript registry as your base, and manually define all Rust overrides using the `extraPackages` directive.

   ```yaml
   workspace:
     packageSet:
       registry: 77.10.1
     extraPackages:
       prelude:
         git: "https://github.com/0x000000000000000000001/purust-prelude.git"
         ref: "master"
         dependencies: []
       # ... all other purust-* packages
     backend:
       cmd: purust
   ```

3. **Build and execute:**
   The compiler will parse all `tcorefn.json` files generated by `purs` (via a TAST-enabled fork) and output native Rust files in the `output/` directory.
   
   An executable `main.rs` entrypoint will be automatically generated. You can run it directly by initializing a Cargo project in the output folder:
   
   ```bash
   spago build
   cd output
   cargo init --bin --name purust_app
   cargo run
   ```

### Compiler configuration options

The `purust` compiler is entirely **zero-config by default**. It will automatically scan your `tcorefn` ASTs and generate a ready-to-execute `main.rs` entrypoint.

If you need advanced behavior, you can pass arguments to the `purust` compiler by appending them to the `spago build --backend-args` command:

```bash
spago build --backend purust --backend-args "--main App.Main"
```

| Option | Description |
|---|---|
| `--main <Module>` | *Optional*. Explicitly sets the entrypoint module. Without this flag, `purust` automatically targets the `Main` module. |

## Local development & testing

If you plan to contribute to the compiler or run the official test suite locally, you will have to follow a specific "sibling-checkout" directory layout. 

Because `purust` replaces the JS ecosystem with Rust, it requires custom Rust-compatible forks of the core PureScript libraries (e.g. `purescript-prelude` becomes `purust-prelude`). The internal test runner (`bin/test`) expects these core `purust-*` repositories to be cloned side-by-side in the same parent directory as the main `purust` repository.

```
workspace/
├── purust/
├── purust-prelude/
├── purust-effect/
├── purust-console/
├── purust-assert/
└── ... (all other core purust-* forks)
```

To easily clone all these required dependencies, you can simply run the provided setup script:
```bash
cd purust
./bin/setup
```

To run the test suite:
```bash
./bin/test
```

## Architecture

`purust` is built on top of [Arista's purescript-backend-optimizer](https://github.com/aristanetworks/purescript-backend-optimizer) to avoid reinventing the optimization wheel. The compilation pipeline is functionally decoupled:

1. **Optimization**: The optimizer reads the `tcorefn.json` generated by `purs`, performs aggressive Dead Code Elimination (DCE), typeclass dictionary resolution, inlining, and constant folding at the AST level, and outputs an optimized `BackendModule`.
2. **Code Generation**: `Purust.CodeGen` maps this heavily optimized PureScript AST to our native `RustAst`.
3. **Printing**: `Purust.Printer` formats the Rust AST into valid, modern Rust syntax.
4. **Caching & CLI**: `Main` orchestrates the CLI, writing the generated `.rs` files to their respective module directories. 

## License

MIT License. See [LICENSE](LICENSE) for details.
