// Known failure: cargo test -p Purs_VariantPublicProbe --example unvariant.
// Run separately from the qualified --tests suite; no ignored/expected panic.
use Purs_VariantPublicProbe::*;
use purust_core::{Value, purust_string_from_utf8 as ps};
fn int(n: i64) -> Value { VariantPublicProbe_integer(n) }
fn text(s: &str) -> Value { VariantPublicProbe_text(ps(s)) }
#[test]
fn eliminator_reconstructs_variant() {
    for x in [int(7), text("é🙂")] { assert!(VariantPublicProbe_equal(VariantPublicProbe_roundtrip(x.clone()), x)); }
}
