# Yoga.JSON / Foreign.Object bridge regression

Run `node tests/tast/json-read-object.mjs --docker` from `purust/purust`.
The runner compiles fresh TAST and official JS from the same unchanged PS
dependencies, then generates native Rc and Arc crates. It exercises the original
`Yoga.JSON.read` / `readImpl` and tagged-sum dictionaries; no substitute decoder
or FFI is injected. Each run retains commands, source hashes and `report.json`
under `b8x/run/bak/rust/output/purust-json-read-object-*`.

The integration failure was `Expected Class` when a PS `{ type, value }` record
crossed into `Foreign.Object.Object`. The targeted compiler/runtime bridge
removed this panic. Fresh run `purust-json-read-object-d5NTXF` then reached the
previously missing `Foreign_Object_toArrayWithKey` (eight failures per mode,
4/12 passed: seven missing-FFI failures and one record-order divergence).
Tests now also compare this FFI's own-key order, payload identity, callback
mutation and exception behavior with the original `Foreign/Object.js`.

After the `toArrayWithKey` port, `purust-json-read-object-c60DIK` executed 165
fresh TAST modules and 17 tests in each Linux mode: 16 passed, one failed, in
both Rc and Arc. The original JSON/tagged-sum paths and all four direct FFI
tests passed. No `Expected Class` or unimplemented fallback remained. The
report stayed `complete: false` for the ordering divergence below until the
compiler limitations were resolved; native runs now complete with 17/17 tests
in both modes.

## Record-label compiler limitations this fixture tracked

Both limitations below were fixed in the compiler instead of rebaselining the
original assertions. The independent dynamic/native numeric-order test is
unchanged.

- Numeric PS record labels used to be emitted as invalid Rust field names
  (`purust-json-read-object-qzCFHx` retains the compile error for `pub 01:`).
  The native field now gains a leading underscore (`pub _01`) while the
  logical label and its dynamic key stay `"01"`;
  `tests/tast/record-keyword.mjs` compiles and exercises the resulting Rust.
- For the valid PS fields `z, alpha, constructor, beta`, fresh TAST Row fields
  and official JS preserve that order, while the native carrier in
  `purust-json-read-object-d5NTXF` enumerated `alpha, beta, constructor, z`
  (`own_property_order_matches_javascript` was left red, not rebaselined).
  Record shape collection now carries a literal's label order into the native
  carrier, so the assertion passes with source order. When the same label set
  is written in several orders, the carrier keeps its canonical (sorted)
  order.
