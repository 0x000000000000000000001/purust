use perceus_ptr::PerceusPtr;

#[test]
fn copy_on_write_preserves_shared_values() {
    let original = PerceusPtr::new(vec![21_i64, 42]);
    let mut updated = original.clone();
    PerceusPtr::make_mut(&mut updated)[0] = 99;
    assert_eq!(&*original, &[21, 42]);
    assert_eq!(&*updated, &[99, 42]);
    drop(original);
    assert!(updated.is_unique());
}

#[cfg(feature = "threaded")]
#[test]
fn threaded_runtime_shares_across_threads() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<PerceusPtr<Vec<i64>>>();
    let original = PerceusPtr::new(vec![42_i64]);
    let shared = original.clone();
    std::thread::spawn(move || assert_eq!(shared[0], 42))
        .join()
        .unwrap();
    assert!(original.is_unique());
}
