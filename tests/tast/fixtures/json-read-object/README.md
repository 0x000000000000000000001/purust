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
report deliberately stays `complete: false` for the ordering divergence below.

## Separate compiler limitations (not fixed by these tests)

- Numeric PS record labels are currently emitted as invalid Rust field names.
  `purust-json-read-object-qzCFHx` retains the compile error for `pub 01:`.
  Numeric enumeration is therefore qualified with actual runtime
  `DynamicRecord` and `SharedRecord` input, not such a PS literal.
- For the valid PS fields `z, alpha, constructor, beta`, fresh TAST Row fields
  and official JS preserve that order. The native generated record carrier in
  `purust-json-read-object-d5NTXF` enumerates `alpha, beta, constructor, z`.
  `own_property_order_matches_javascript` retains the original order assertion
  and fails on this divergence; it is not rebaselined to alphabetic order.
  The dynamic/native numeric-order test is independent, so this failure cannot
  hide its result. No compiler modification belongs to this fixture.
