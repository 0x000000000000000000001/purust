# PureScript / Rust ownership experiments

An executable comparison of ways to protect Rust resources used from PureScript.
This grew out of the question whether a library can recover useful ownership
guarantees without adding linear types to the source language.

The results show several viable tradeoffs. Generic linear combinators and indexed
capabilities both provide useful static restrictions in a controlled API. Scoped
regions alone do not enforce consumption counts. Checked native wrappers permit
ordinary handles but detect invalid uses at runtime. Keeping ordinary source
syntax while rejecting ownership mistakes requires additional analysis beyond
ordinary foreign type declarations.

These are small experiments, not a claim to have exhausted every encoding or
recovered Rust's complete borrow checker. No production compiler or runtime code
was changed.

## Run and reproduce

From the `purust` repository root:

```sh
node examples/linearity-lab/run.mjs
# One family:
node examples/linearity-lab/run.mjs --suite indexed
# Keep the temporary TAST and Cargo workspaces:
node examples/linearity-lab/run.mjs --suite combinators --keep-output
```

Requirements are the existing built `bin/purust.js`, the TAST compiler fork,
Node.js with `fs.globSync`, installed PureScript dependencies/library ports, and
Rust/Cargo. The automatic suite also needs the Cargo dependencies pinned in its
extractor manifest available locally. Cargo runs offline. The script discovers
the fork with the existing native-bootstrap helper; `PURUST_PURS` or `PURS` can
select another executable.

Each case gets a fresh compilation output. Rejections must have the expected
diagnostic code in the expected test module. Accepted counterexamples are marked
as such; a compiler accepting an unsafe usage is useful evidence, not a passing
ownership guarantee. Every executed Rust example asserts its expected behavior.

Per-suite reports, exact commands, diagnostics and generated Rust are saved under
`artifacts/` (Git-ignored). Failed runs retain their temporary workspace. The
checked-in [results snapshot](results.json) summarizes the verified run without
machine-specific paths; rerunning the suite produces fresh detailed reports.

## Approaches compared

| Approach | Observed guarantee | Caller effort / tradeoff | Evidence |
| --- | --- | --- | --- |
| Phantom state on an ordinary handle | Old aliases remain usable; insufficient by itself | Small API change, no usage accounting | [Counterexample](indexed/PhantomCounterexample.purs) |
| Single-session `Open -> Closed` program | Composition enforces a fixed protocol while Rust owns the hidden resource | Handwritten protocol and combinators | [Earlier POC](../ffi-session/README.md), separately runnable |
| Phil/rightfold linear arrows | Generic resource flow through restricted combinators; historical `Shared` boundaries reject resource escape | Compose and route arguments explicitly; trusted primitives | [Combinators](combinators/README.md) |
| Indexed monad with capability rows | Per-key consumption accounting, alias/replay rejection, all live resources finished on normal return | Qualified `R.do` and explicit fresh keys; intermediate rows inferred | [Indexed capabilities](indexed/README.md) |
| Rank-2 callbacks, existential packaging | Direct escape is blocked, but unindexed effects and existential packages can retain usable handles | Scope annotations alone do not enforce linearity | [Regions](regions/README.md) |
| Region-indexed effects / actual ST | Scoped operations cannot simply be executed outside their scope; aliases remain legal inside | Region-aware API; useful confinement, not consumption accounting | [Regions](regions/README.md) |
| Checked native owner | At most one successful consumption across aliases, replay, reentrancy and a tested thread race | Ordinary `Effect` calls; runtime result handling, locks and checks | [Native guard](regions/Guarded.rs) |
| Rust contract extraction + extra TAST check | Automatic extraction works for a small subset; additional analysis catches several ordinary-syntax ownership mistakes | Little caller syntax overhead, substantial tooling work; limited prototype | [Automatic](automatic/README.md) |

These techniques can be combined. Generating primitives for an indexed or linear
API can reduce wrapper-writing effort. A runtime guard can cover operations whose
ownership cannot be established statically. Neither combination was built as an
automatic end-to-end system in this investigation.

## Verified outcomes

The lab checks **66 PureScript programs: 38 expected rejections and 28 expected
acceptances**. Some accepted programs deliberately demonstrate a route's limits.

- `combinators`: 21 cases, plus real native execution in both backend modes.
  This includes a compatibility copy of one historical rightfold module for
  typechecking and a separately identified, newly written Rust adaptation.
- `indexed`: 20 cases, plus a real two-resource program executed twice in both
  modes. Four resources are created, finished, and dropped per execution.
- `regions`: 13 cases, plus native runtime guards and the installed ST port
  executed in both modes. Reentrancy and a real two-thread consumption race are
  included.
- `automatic`: 12 programs accepted by ordinary PureScript. The supplementary
  checker accepts four, detects five ownership violations, and declines three
  unsupported cases. Three unsupported Rust signature forms are rejected.
  Independent native Rust controls include one execution and two compile errors.

The six purust-native executions use the normal and `--threaded` modes. Only the
runtime-guard suite launches concurrent threads. The earlier `ffi-session` POC
has its own runner and is not counted in these 66 cases. No performance comparison
or benchmark claim is made.

## What this means for FFI design

The indexed API currently gives the closest demonstrated library-only route to
familiar sequential PureScript code:

```purescript
action = R.run R.do
  first <- R.open (Proxy :: Proxy "first") 10
  second <- R.open (Proxy :: Proxy "second") 20
  observed <- R.inspect first
  R.add second observed
  left <- R.finish first
  right <- R.finish second
  R.pure (left + right)
```

The programmer supplies fresh names; the compiler infers the history/live rows.
This avoids handwriting a new pair of state types for each operation. The
resource wrapper, trusted primitives and scope boundary still need design.
The native arena uses map lookups and a mutex; a successful type check does not
establish that representation as zero-cost.

The combinator route is also viable and more directly expresses owned values
flowing between operations. Its ergonomic cost is explicit routing with
composition, tensor, swap and associators. The historical library has useful
generic sharing constraints; its complete runtime has not been ported here.

Rust ownership is primarily affine: a value may be dropped without an explicit
finalizing operation. Some experiments impose the stronger application protocol
of requiring `finish` on normal completion. Neither promises successful completion
under divergence, exceptions, panic, cancellation or process termination.

The remaining hard cases include borrowed results with lifetimes, higher-order
resource callbacks, containers of resources, dynamically many independently
named resources, intermodule ownership analysis, and general async APIs. A full
source-language extension and a complete Rust signature-to-wrapper generator
are not implemented or established by this lab.

## Primary sources

- [Phil Freeman: Embedding Linear Lambda Calculus](https://blog.functorial.com/posts/2017-08-05-Embedding-Linear-Lambda-Calculus.html)
- [Historical rightfold API and source provenance](combinators/README.md)
- [Gary Burgess: indexed-monad](https://github.com/garyb/purescript-indexed-monad)
- [Multiparty Session Type-safe Web Development with Static Linearity](https://arxiv.org/abs/1904.01287)
- [PureScript ST](https://pursuit.purescript.org/packages/purescript-st/6.2.0/docs/Control.Monad.ST)

Each suite distinguishes copied historical code, newly written adaptations,
static-only probes, and actual native execution.
