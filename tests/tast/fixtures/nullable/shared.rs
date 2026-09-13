use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use purust_core::Func1;
use Purs_NullableProbe::*;

#[test]
fn nullable_handles_and_callbacks_can_be_shared_across_threads() {
    let calls = Arc::new(AtomicUsize::new(0)); let count = calls.clone();
    let function = NullableProbe_functionValue(Func1::Shared(Arc::new(move |x| {
        count.fetch_add(1, Ordering::SeqCst); x + 7
    })));
    let nested = NullableProbe_nest(NullableProbe_intValue(19));
    let workers: Vec<_> = (0..4).map(|_| {
        let function = function.clone(); let nested = nested.clone();
        std::thread::spawn(move || {
            for x in 0..25 {
                assert_eq!(NullableProbe_callFunction(function.clone(), x), x + 7);
                assert_eq!(NullableProbe_decodeNested(-999, nested.clone()), 19);
            }
        })
    }).collect();
    for worker in workers { worker.join().unwrap(); }
    assert_eq!(calls.load(Ordering::SeqCst), 100);
}
