use std::sync::Arc;
use Purs_JS_BigInt::BigInt;

#[test]
fn immutable_bigint_handle_crosses_threads() {
    fn send_sync<T: Send + Sync>() {}
    send_sync::<BigInt>();
    let value = Arc::new(BigInt::from(1) << 4096usize);
    let moved = value.clone();
    let returned = std::thread::spawn(move || Purs_BigIntProbe::BigIntProbe_keep(moved)).join().unwrap();
    assert!(Arc::ptr_eq(&value, &returned));
}
