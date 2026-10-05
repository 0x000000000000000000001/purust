# Automatic elimination of linear lambdas

This experiment removes the manual lambda-to-combinator translation from the
earlier library experiment. It implements BCI bracket abstraction over an
explicit lambda AST, then compares the generated program with an independent
lambda interpreter.

```sh
node examples/linearity-lab/run.mjs --suite abstraction
```

For the algorithm alone, without invoking the PureScript harness:

```sh
node examples/linearity-lab/abstraction/tests.mjs
```

The observed result is **251 accepted programs, 16 targeted rejections and
613 semantic comparisons**, plus three deliberately adverse controls.
The harness also compiles one unrelated PureScript smoke module; this is
clearly identified and is not counted as an implementation of BCI in
PureScript. The substantive tests run the JavaScript algorithm.

## What becomes automatic

The source AST has variables, explicit globals, application and lambda
abstraction. The compiler resolves names into distinct binder identities,
so shadowing does not confuse occurrence counts. Every local binder must
be used exactly once.

For an abstraction over `x`, the rules are:

```text
[x] x       = I
[x] (f x)   = f                 when x is absent from f (eta)
[x] (f t)   = B f ([x] t)       when x occurs only in t
[x] (t y)   = C ([x] t) y       when x occurs only in t
```

Here `B f g x = f (g x)` and `C f y x = f x y`. Nested lambdas are eliminated
from the inside outward. Duplication and omission are rejected before
elimination; the algorithm never silently inserts `S`, `W`, or `K`.

The article's example produces its exact result:

```text
λa b c d e. a (b c) (d e)
  → B (B (B B)) B
```

Exchange is also generated automatically:

```text
λf x. x f
  → C I
```

So users need not perform those translations themselves once a frontend
provides the AST. This folder does **not** parse ordinary PureScript text
or consume TAST. The separate lowering experiment deals with that next
boundary.

## Original examples inspected

The approach comes from
[Phil Freeman's article](https://blog.functorial.com/posts/2017-08-05-Embedding-Linear-Lambda-Calculus.html).
Both original linked examples were retrieved and inspected through the
GitHub Gist API:

- [The BI example](https://gist.github.com/anonymous/7c3055b578a58428aeb31cfa43162b23)
  uses a nameless representation for already ordered terms. It does not
  implement named scope resolution or the general exchange rule.
- [The resource example](https://gist.github.com/anonymous/51d7971a85d6e1cd38b02e04e2fa1ced)
  illustrates higher-order arrows with `composeL`, `composeR` and `flip`.
  Its `FileStream` is a placeholder, not an actual native file handle. Its
  single demonstration module includes the raw constructor and eliminator;
  the comment calls for hiding the constructor in a real API.

`algorithm.mjs` and the tests are an original implementation of the stated
equations, not copies of either gist. No explicit gist license was found.

Our optional `basis: 'BI'` mode runs the same algorithm without exchange and
rejects a term whenever the chosen rules need `C`. It handles the tested
ordered application chains, including the article example. We do not claim
a completeness theorem for this mode with arbitrary closed primitives or
nested closed subterms.

## What the checks cover

Positive observations cover identity, eta, composition, the article example,
left-side uses requiring `C`, explicit closed constants, named shadowing,
all 120 permutations of five inputs, and all 120 combinations of a binary
pair tree shape with a permutation of four leaves. Each generated program
is evaluated and compared with the original lambda AST on concrete inputs.
Several small results and target terms also have independent golden checks.

Rejections cover duplicated or unused bindings (including beneath lambdas
and shadowing), unresolved variables, unknown globals, unsupported nodes,
and exchanges in BI mode.

A closed global is not automatically safe. The manifest distinguishes an
immutable scalar constant from a trusted linear function. A function
explicitly declared nonlinear, a function disguised as a scalar, or a
closed mutable object is rejected. The body of a function declared linear
remains trusted; a declaration is not a proof.

## Limits demonstrated by execution

Three controls are recorded separately from the successful equivalence
tests:

1. **This is not type inference.** Applying one scalar constant to another
   passes the use checker and is rejected by both evaluators. A frontend
   must separately establish ordinary type correctness.
2. **A dishonest primitive breaks the contract.** A falsely declared linear
   function duplicates an input. The pass cannot infer ownership laws from
   an opaque JavaScript or FFI function body.
3. **Eta needs semantic care.** An effect hidden in a function-producing
   expression runs earlier after eta elimination, despite producing the
   same final value. The positive comparisons use pure total functions.
   Applying this translation around native effects requires preserving
   staging and evaluation order, rather than assuming unrestricted eta is
   operationally harmless.

There is no formal correctness proof, claim of all possible lambda terms
being tested, benchmark, or automatic recovery of Rust lifetimes here.
In particular, generated higher-order arrows must not expose captured live
resources as ordinary reusable PureScript functions. The protected
execution boundary and the trusted primitive implementation remain
necessary. This phase automates syntax construction; it does not turn
unrestricted PureScript into a linear language by itself.

`../artifacts/abstraction/abstraction.json` records every accepted/rejected
case, target term, applied rule counts and observed controls. The shared
harness's `report.json` and `commands.json` record the actual run.
