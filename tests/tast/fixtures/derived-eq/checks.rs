// Derived Eq must stay compact and select the runtime dictionary that
// matches the compared type. The size assertions live in derived-eq.mjs; here
// only the behavior of the generated instances is exercised.
use Purs_DerivedEqConsumer::*;
use Purs_DerivedEqProbe::*;

fn main() {
    assert!(DerivedEqProbe_same());
    assert!(!DerivedEqProbe_different());
    assert!(DerivedEqProbe_differentTypes());
    assert!(DerivedEqProbe_equalQuery());
    assert!(!DerivedEqProbe_differentQuery());
    assert!(DerivedEqProbe_equalRepeat());
    assert!(!DerivedEqProbe_differentRepeat());
    assert!(DerivedEqProbe_equalCall());
    assert!(!DerivedEqProbe_differentLabel());
    assert!(!DerivedEqProbe_differentTerm());
    assert!(!DerivedEqProbe_differentLength());

    // The user instance is not structural: congruent `Key`s are equal.
    assert!(DerivedEqProbe_keyCustomEqual());
    assert!(!DerivedEqProbe_keyCustomDifferent());

    // The instances stay reachable through their runtime dictionaries from
    // another module.
    assert!(DerivedEqConsumer_crossModuleSame());
    assert!(!DerivedEqConsumer_crossModuleDifferent());
    assert!(DerivedEqConsumer_crossModuleGiven());
    assert!(!DerivedEqConsumer_crossModuleGivenDifferent());

    // Nested patterns still resolve to the right inner constructor.
    assert_eq!(DerivedEqProbe_nestedLit(), 42);
    assert_eq!(DerivedEqProbe_nestedVar(), 1);
    assert_eq!(DerivedEqProbe_nestedAnd(), 2);
    assert_eq!(DerivedEqProbe_nestedList(), 3);
    assert_eq!(DerivedEqProbe_nestedSum(), 4);
    assert_eq!(DerivedEqProbe_nestedFallback(), 5);
    assert_eq!(DerivedEqProbe_nestedOther(), 0);

    println!("Derived Eq behavior: recursive instances, custom dictionary and nested patterns passed.");
}
