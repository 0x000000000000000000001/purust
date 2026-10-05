use std::rc::Rc;
use std::sync::{Arc, Mutex, TryLockError};
use std::sync::atomic::{AtomicUsize, Ordering};

static CREATED: AtomicUsize = AtomicUsize::new(0);
static FINISHED: AtomicUsize = AtomicUsize::new(0);
static DROPPED: AtomicUsize = AtomicUsize::new(0);

// Neither Clone nor Copy: only the wrapper handle can be shared.
struct Session { value: i64 }
impl Session {
    fn new(value: i64) -> Self {
        CREATED.fetch_add(1, Ordering::SeqCst);
        Self { value }
    }
    fn inspect(&self) -> i64 { self.value }
    fn finish(self) -> i64 {
        FINISHED.fetch_add(1, Ordering::SeqCst);
        self.value
    }
}
impl Drop for Session {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

pub struct Handle { cell: Arc<Mutex<Option<Session>>> }

#[derive(Debug)]
enum GuardError { Consumed, Busy, Poisoned }

fn status(result: Result<i64, GuardError>) -> i64 {
    match result {
        Ok(value) => value,
        Err(GuardError::Consumed) => -1,
        Err(GuardError::Busy) => -2,
        Err(GuardError::Poisoned) => -3,
    }
}

fn finish_cell(cell: &Mutex<Option<Session>>) -> Result<i64, GuardError> {
    let session = {
        let mut guard = cell.try_lock().map_err(|error| match error {
            TryLockError::WouldBlock => GuardError::Busy,
            TryLockError::Poisoned(_) => GuardError::Poisoned,
        })?;
        guard.take().ok_or(GuardError::Consumed)?
    };
    // The native by-value operation runs after releasing the wrapper's lock.
    Ok(session.finish())
}

pub fn LinearLab_Regions_Guarded_open(initial: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let handle = Rc::new(Handle { cell: Arc::new(Mutex::new(Some(Session::new(initial)))) });
        // Native foreign handles use Class's nested owner ABI.
        Value::Class(Rc::new(handle))
    })))
}

pub fn LinearLab_Regions_Guarded_inspect(handle: Rc<Handle>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let result = match handle.cell.try_lock() {
            Ok(guard) => guard.as_ref().map(Session::inspect).ok_or(GuardError::Consumed),
            Err(TryLockError::WouldBlock) => Err(GuardError::Busy),
            Err(TryLockError::Poisoned(_)) => Err(GuardError::Poisoned),
        };
        Value::Int(status(result))
    })))
}

pub fn LinearLab_Regions_Guarded_finish(handle: Rc<Handle>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| Value::Int(status(finish_cell(&handle.cell))))))
}

pub fn LinearLab_Regions_Guarded_withBorrow(handle: Rc<Handle>, action: Value) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let guard = handle.cell.try_lock().expect("demo acquires a fresh borrow");
        assert!(guard.is_some());
        let result = action.unwrap_func1()(Value::Unit);
        drop(guard);
        result
    })))
}

pub fn LinearLab_Regions_Guarded_race(handle: Rc<Handle>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let start = Arc::new(std::sync::Barrier::new(3));
        let workers: Vec<_> = (0..2).map(|_| {
            let cell = handle.cell.clone();
            let start = start.clone();
            std::thread::spawn(move || {
                start.wait();
                // Retry only transient lock contention. Once the owner has
                // been moved out, every later attempt returns Consumed.
                loop {
                    match finish_cell(&cell) {
                        Err(GuardError::Busy) => std::thread::yield_now(),
                        result => break status(result),
                    }
                }
            })
        }).collect();
        start.wait();
        let mut results: Vec<_> = workers.into_iter().map(|worker| worker.join().unwrap()).collect();
        results.sort();
        assert_eq!(results, vec![-1, 30]);
        println!("RACE results=consumed,30");
        Value::Int(results[1])
    })))
}

pub fn LinearLab_Regions_Guarded_assertEqual(expected: i64, actual: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert_eq!(actual, expected);
        println!("ASSERT actual={actual} expected={expected}");
        Value::Unit
    })))
}

pub fn LinearLab_Regions_Guarded_verify() -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let counts = (
            CREATED.load(Ordering::SeqCst),
            FINISHED.load(Ordering::SeqCst),
            DROPPED.load(Ordering::SeqCst),
        );
        assert_eq!(counts, (3, 3, 3));
        println!("REGIONS_GUARD_OK");
        Value::Unit
    })))
}
