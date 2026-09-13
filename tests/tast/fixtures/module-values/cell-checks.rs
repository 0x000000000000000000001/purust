use purust_core::module_values::Cell;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::{atomic::{AtomicUsize, Ordering}, Arc, Barrier};

fn caught(f: impl FnOnce()) -> String {
    let error = catch_unwind(AssertUnwindSafe(f)).expect_err("expected initialization failure");
    error.downcast_ref::<String>().cloned()
        .or_else(|| error.downcast_ref::<&str>().map(|text| text.to_string())).unwrap()
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("poison") => {
            let cell = Cell::<i64>::new();
            let calls = AtomicUsize::new(0);
            assert_eq!(caught(|| { cell.get_or_init("failure", || {
                calls.fetch_add(1, Ordering::SeqCst); panic!("original failure")
            }); }), "original failure");
            assert!(caught(|| { cell.get_or_init("failure", || {
                calls.fetch_add(1, Ordering::SeqCst); 42
            }); }).contains("previously failed: failure"));
            assert_eq!(calls.load(Ordering::SeqCst), 1);
        }
        Some("cycle") => {
            let first = Cell::<i64>::new();
            let second = Cell::<i64>::new();
            assert!(caught(|| { first.get_or_init("first", || {
                *second.get_or_init("second", || *first.get_or_init("first", || 42))
            }); }).contains("cyclic module value initialization: first"));
            for (cell, name) in [(&first, "first"), (&second, "second")] {
                assert!(caught(|| { cell.get_or_init(name, || 42); }).contains("previously failed"));
            }
        }
        Some("cross-cycle") => {
            let cells = Arc::new([Cell::<i64>::new(), Cell::<i64>::new()]);
            let barrier = Arc::new(Barrier::new(2));
            let threads: Vec<_> = (0..2).map(|index| {
                let cells = cells.clone(); let barrier = barrier.clone();
                std::thread::spawn(move || caught(|| {
                    cells[index].get_or_init("cycle", || {
                        barrier.wait();
                        *cells[1-index].get_or_init("cycle", || unreachable!())
                    });
                }))
            }).collect();
            let messages: Vec<_> = threads.into_iter().map(|thread| thread.join().unwrap()).collect();
            assert!(messages.iter().any(|message| message.contains("cyclic module value")));
            assert!(messages.iter().any(|message| message.contains("previously failed")));
        }
        Some("concurrent-poison") => {
            let cell = Arc::new(Cell::<i64>::new());
            let calls = Arc::new(AtomicUsize::new(0));
            let barrier = Arc::new(Barrier::new(8));
            let threads: Vec<_> = (0..8).map(|_| {
                let cell = cell.clone(); let calls = calls.clone(); let barrier = barrier.clone();
                std::thread::spawn(move || { barrier.wait(); caught(|| {
                    cell.get_or_init("failure", || { calls.fetch_add(1, Ordering::SeqCst); panic!("original failure") });
                }) })
            }).collect();
            let messages: Vec<_> = threads.into_iter().map(|thread| thread.join().unwrap()).collect();
            assert_eq!(calls.load(Ordering::SeqCst), 1);
            assert_eq!(messages.iter().filter(|message| message.as_str() == "original failure").count(), 1);
        }
        Some("concurrent-dependency") => {
            let cells = Arc::new([Cell::<i64>::new(), Cell::<i64>::new()]);
            let barrier = Arc::new(Barrier::new(2));
            let first_cells = cells.clone(); let first_barrier = barrier.clone();
            let first = std::thread::spawn(move || *first_cells[0].get_or_init("first", || {
                first_barrier.wait();
                *first_cells[1].get_or_init("second", || unreachable!()) + 1
            }));
            let second_cells = cells.clone();
            let second = std::thread::spawn(move || *second_cells[1].get_or_init("second", || {
                barrier.wait(); 41
            }));
            assert_eq!(first.join().unwrap(), 42);
            assert_eq!(second.join().unwrap(), 41);
            assert_eq!(*cells[0].get_or_init("first", || unreachable!()), 42);
        }
        _ => panic!("Expected a cell policy case"),
    }
    println!("ok");
}
