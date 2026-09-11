use purust_core::*;
use Purs_RecordSetProbe::*;

fn counts(value: &Value) -> (i64, i64, i64) {
    (
        value.get_failed().unwrap_int(),
        value.get_passed().unwrap_int(),
        value.get_pending().unwrap_int(),
    )
}

#[test]
fn record_zero_and_addition_preserve_the_original() {
    let zero = RecordSetProbe_zeroCounts();
    assert_eq!(counts(&zero), (0, 0, 0));
    let one = RecordSetProbe_replacePassed(1, zero.clone());
    assert_eq!(counts(&zero), (0, 0, 0));
    assert_eq!(counts(&one), (0, 1, 0));
    assert_eq!(
        counts(&RecordSetProbe_addCounts(one.clone(), one.clone())),
        (0, 2, 0)
    );
    assert_eq!(counts(&one), (0, 1, 0));
}

#[test]
fn actual_spec_summary_handles_empty_mixed_and_nested_results() {
    assert_eq!(counts(&RecordSetProbe_emptySummary()), (0, 0, 0));
    assert_eq!(counts(&RecordSetProbe_mixedSummary()), (1, 2, 1));
}

#[test]
fn extending_a_closed_shape_remains_readable_and_updatable() {
    let before = RecordSetProbe_partialCounts(3, 4);
    let extended = RecordSetProbe_addPassed(5, before.clone());
    assert!(before.__purust_get_field("passed").is_none());
    assert_eq!(RecordSetProbe_readPassed(extended.clone()), 5);
    assert_eq!(
        counts(&RecordSetProbe_ordinaryUpdate(7, extended.clone())),
        (3, 7, 4)
    );
    assert_eq!(counts(&extended), (3, 5, 4));
}
