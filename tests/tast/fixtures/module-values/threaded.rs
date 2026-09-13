use purust_core::*;
use std::sync::{Arc, Barrier};
use Purs_ModuleInitProbe::*;
use Purs_ModuleInitProbe_Counter::*;

fn run(action: Value) -> Value { action.unwrap_func1()(Value::Unit) }
fn main() {
    let barrier = Arc::new(Barrier::new(8));
    let threads: Vec<_> = (0..8).map(|_| {
        let barrier = barrier.clone();
        std::thread::spawn(move || { barrier.wait(); ModuleInitProbe_shared() })
    }).collect();
    let handles: Vec<_> = threads.into_iter().map(|thread| thread.join().unwrap()).collect();
    for handle in &handles {
        match (&handles[0], handle) {
            (Value::Class(first), Value::Class(other)) => assert!(Arc::ptr_eq(first, other)),
            _ => panic!("Expected Ref handles"),
        }
    }
    std::thread::spawn(|| { run(ModuleInitProbe_store(42)); }).join().unwrap();
    assert_eq!(std::thread::spawn(|| run(ModuleInitProbe_load()).unwrap_int()).join().unwrap(), 42);
    assert_eq!(run(ModuleInitProbe_Counter_readCount()).unwrap_int(), 1);
    println!("ok");
}
