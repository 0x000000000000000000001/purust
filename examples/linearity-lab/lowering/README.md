# Generate native linear arrows from PureScript expressions

This experiment tests the ergonomic step omitted by the first combinator POC:
users write variables, applications, `let` and pair patterns; an extra pass
generates the composition, tensor, swap and associators automatically.

```sh
node examples/linearity-lab/run.mjs --suite lowering
```

For example, this actual input module is compiled by the TAST fork:

```purescript
program :: Int -> Int
program initial =
  let
    session = S.open initial
    updated = S.add 7 session
    observed = S.inspect updated
  in S.finish observed
```

The pass produces a typed `L.Linear Int Int` program, compiles that generated
PureScript, then runs it through purust and Cargo in both normal and threaded
modes. The caller writes no `then_`, `tensor`, `swap` or associators. The generated
code can be inspected in `../artifacts/lowering/Generated.purs`.

This is first-order symmetric-monoidal routing, not the full higher-order BCI
algorithm. The separate [abstraction experiment](../abstraction/README.md) tests
BCI itself. They establish complementary steps, not one general compiler.

## What is actually verified

Eleven ordinary source programs are typechecked, plus the shared arrow module
as an infrastructure control. Six programs pass the extra linear check and are
generated; three fail its usage check and two exceed its supported syntax/API.

The native execution covers:

- A sequential pipeline and replay of the same effect, producing 17 twice.
- Two resources with reversed output order, producing 23. Routing is generated.
- Reading a resource before and after mutation: snapshots 10 and 13 are retained,
  and final consumption returns 13, producing a total of 36.
- A single-use alias and lexical shadowing, producing 11 and 12.
- Explicit duplication of an `Int` through its allowed primitive, producing 20.

Native assertions verify seven creations, seven consuming calls and seven drops.
The action is passed to a checking FFI before it runs; the counts are still zero
after construction. The runner also compares the complete ordered trace,
including `OPEN`, `READ`, `ADD` and `FINISH`, against the expected TAST execution.

Implicit scalar duplication, double consumption through an alias and an unused
resource are rejected by the extra pass. Ordinary borrow-shaped `read session`
and local function abstraction are reported as unsupported. They are not claimed
to be inherently unsafe programs.

The resolver assigns distinct lexical identities before counting uses. It never
uses the printed name alone, never treats one direct use as proof of exclusive
ownership, and never substitutes a shared resource-producing let at both uses.
Every binder in this restricted fragment must occur exactly once. The routing
phase maintains the live wires and consumes them through trusted primitives.
The generated program is then independently typechecked by PureScript.

An independent structural test interprets the generated arrows for all
permutations and binary groupings of two through five leaves: **1,814 cases**,
plus shadowing and alias-duplication controls. These use synthetic ASTs, not
1,814 extra PureScript compilations. Run them separately with
`node examples/linearity-lab/lowering/routing-tests.mjs`, or inspect the harness's
`../artifacts/lowering/routing.json` report.

## Important semantic boundary

`Source.purs` contains **specification signatures**, not an executable native
FFI. The trusted mappings target our existing linear arrow primitives. `open`,
`add` and `finish` are modelled as transformations of uniquely threaded abstract
values. The source compilation alone does not enforce that discipline; the extra
pass must succeed before generating anything executable.

These signatures are pure. PureScript may reorder independent `let` bindings
before this pass receives the TAST. That is visible in `TwoResources`: its TAST
processes the right-hand resource first even though the left allocation appears
first in the source text. Our lowering preserves the **received TAST order**,
not an imperative interpretation of the textual order. The native logging is
diagnostic instrumentation. Arbitrary I/O or destructor effects cannot safely be
given these pure signatures merely to use this transformation. They need explicit
effect sequencing and a transformation which preserves it.

The `Observed` probe establishes the dependent order
`open -> read -> add -> read -> finish`. It does not prove general equivalence
for effectful native APIs. This lowering performs no eta reduction or let
substitution. The separate BCI experiment demonstrates why unrestricted eta
around hidden effects would require additional care.

## Remaining caller and implementer effort

This removes manual combinator routing in the accepted fragment. It still needs
an extra compiler stage and a known set of trusted primitives. It does not derive
these primitives from arbitrary Rust signatures.

A borrowed scalar result currently uses explicit ownership threading:

```purescript
observe :: Session -> Pair Session Int
```

The source pattern receives both the owner and the snapshot. Automatically
turning ordinary repeated `&Session`/`&mut Session` calls into this flow remains a
different transformation. The tested `OrdinaryBorrow` case makes this gap visible.

The current pass deliberately requires one occurrence even for ordinary scalars;
the caller uses `duplicate` when sharing an `Int`. Automatically inserting lawful
`Clone`/`Shared` operations from types is not implemented. Literal `add` amounts
are allowed as primitive configuration. Closed value construction, arbitrary
branches, recursive functions, higher-order resource closures, borrowed returns
and general effects are outside this fragment. Its entrypoint is restricted to
`Int -> Int`; the generated signature enforces that boundary.

There is no inference of general Rust lifetimes, zero-cost claim, performance
benchmark, or formal translation-correctness proof. This establishes an actual
path from ordinary-looking linear expressions to executed Rust without requiring
users to write the wiring themselves.
