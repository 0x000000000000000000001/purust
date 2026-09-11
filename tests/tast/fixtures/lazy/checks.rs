use purust_core::*;
use std::rc::Rc;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use Purs_Data_Lazy::{Data_Lazy_lazyLazy, Lazy};
use Purs_LazyProbe::*;

#[test]
fn native_consumer_retains_and_reads_the_same_cell() {
    let value = LazyProbe_construct(42);
    let alias = LazyProbe_retain(value.clone());
    assert!(Rc::ptr_eq(&value, &alias));
    assert_eq!(LazyProbe_consume(value), 42);
    assert_eq!(LazyProbe_consume(alias), 42);
}

#[test]
fn the_control_lazy_dictionary_wraps_the_foreign_lazy_payload() {
    let calls = Arc::new(AtomicUsize::new(0));
    let seen = calls.clone();
    let dictionary: Rc<Purs_Control_Lazy::Lazy> = Data_Lazy_lazyLazy();
    let boxed = (dictionary.defer)(Func1::Shared(Rc::new(move |_| {
        seen.fetch_add(1, Ordering::SeqCst);
        Value::Class(Rc::new(LazyProbe_construct(42)))
    })));
    let value = boxed.unwrap_class::<Rc<Lazy>>().clone();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(LazyProbe_consume(value.clone()), 42);
    assert_eq!(LazyProbe_consume(value), 42);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}
