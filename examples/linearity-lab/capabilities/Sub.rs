use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

static OWNED_OPEN: AtomicUsize = AtomicUsize::new(0);
static OWNED_FINISH: AtomicUsize = AtomicUsize::new(0);
static OWNED_DROP: AtomicUsize = AtomicUsize::new(0);
static DISPOSABLES_AT_FINISH: std::sync::Mutex<Vec<usize>> = std::sync::Mutex::new(Vec::new());
static DISPOSABLE_OPEN: AtomicUsize = AtomicUsize::new(0);
static DISPOSABLE_DROP: AtomicUsize = AtomicUsize::new(0);
static DEEP_OPEN: AtomicUsize = AtomicUsize::new(0);
static DEEP_CLONE: AtomicUsize = AtomicUsize::new(0);
static DEEP_FINISH: AtomicUsize = AtomicUsize::new(0);
static DEEP_DROP: AtomicUsize = AtomicUsize::new(0);
static SHARED_OPEN: AtomicUsize = AtomicUsize::new(0);
static SHARED_CLONE: AtomicUsize = AtomicUsize::new(0);
static SHARED_HANDLE_DROP: AtomicUsize = AtomicUsize::new(0);
static SHARED_PAYLOAD_DROP: AtomicUsize = AtomicUsize::new(0);

fn count(counter: &AtomicUsize) -> usize { counter.load(Ordering::SeqCst) }

// Neither Clone nor Copy. Rust destruction exists, but the PS API deliberately
// requires finish rather than granting the generic Drop capability.
pub struct NativeOwned { value: i64 }
impl std::ops::Drop for NativeOwned {
    fn drop(&mut self) { OWNED_DROP.fetch_add(1, Ordering::SeqCst); }
}

// Also neither Clone nor Copy; unlike Owned, this has a public PS Drop policy.
pub struct NativeDisposable { value: i64 }
impl std::ops::Drop for NativeDisposable {
    fn drop(&mut self) {
        DISPOSABLE_DROP.fetch_add(1, Ordering::SeqCst);
        println!("CAP_DISPOSE {}", self.value);
    }
}

// Real native Clone: a new allocation with independent mutable contents.
pub struct NativeDeep { values: Vec<i64> }
impl std::clone::Clone for NativeDeep {
    fn clone(&self) -> Self {
        DEEP_CLONE.fetch_add(1, Ordering::SeqCst);
        let cloned = Self { values: self.values.clone() };
        assert_ne!(self.values.as_ptr(), cloned.values.as_ptr());
        println!("CAP_DEEP_CLONE independent=true");
        cloned
    }
}
impl std::ops::Drop for NativeDeep {
    fn drop(&mut self) { DEEP_DROP.fetch_add(1, Ordering::SeqCst); }
}

// Shared is intentionally a different contract. Immutable payload, multiple
// Arc handles, one payload destruction after the last handle is released.
struct SharedPayload { value: i64 }
impl std::ops::Drop for SharedPayload {
    fn drop(&mut self) { SHARED_PAYLOAD_DROP.fetch_add(1, Ordering::SeqCst); }
}
pub struct SharedHandle { payload: Arc<SharedPayload> }
impl std::clone::Clone for SharedHandle {
    fn clone(&self) -> Self {
        SHARED_CLONE.fetch_add(1, Ordering::SeqCst);
        let cloned = Self { payload: Arc::clone(&self.payload) };
        assert!(Arc::ptr_eq(&self.payload, &cloned.payload));
        println!("CAP_SHARED_CLONE aliases=true handles={}", Arc::strong_count(&self.payload));
        cloned
    }
}
impl std::ops::Drop for SharedHandle {
    fn drop(&mut self) { SHARED_HANDLE_DROP.fetch_add(1, Ordering::SeqCst); }
}

pub enum Code {
    Primitive(i64, i64), Compose(Rc<Code>, Rc<Code>), Tensor(Rc<Code>, Rc<Code>),
    // The only extension point needed by separate trusted Rust FFI modules.
    Native(fn(Datum) -> Datum),
}
// No Clone implementation here: the evaluator cannot duplicate arbitrary data.
pub enum Datum {
    Int(i64), Unit, Owned(NativeOwned), Disposable(NativeDisposable),
    Deep(NativeDeep), Shared(SharedHandle), Pair(Box<Datum>, Box<Datum>),
    Foreign(Box<dyn std::any::Any + Send + Sync>),
}
fn pair(left: Datum, right: Datum) -> Datum { Datum::Pair(Box::new(left), Box::new(right)) }

pub fn native_code(operation: fn(Datum) -> Datum) -> Rc<Code> {
    Rc::new(Code::Native(operation))
}

pub fn foreign_value<T: std::any::Any + Send + Sync>(value: T) -> Datum {
    Datum::Foreign(Box::new(value))
}

pub fn take_foreign<T: std::any::Any + Send + Sync>(value: Datum) -> T {
    match value {
        Datum::Foreign(value) => *value.downcast::<T>().expect("Incorrect trusted foreign signature"),
        _ => panic!("Incorrect trusted foreign input"),
    }
}

fn execute(code: &Code, input: Datum) -> Datum {
    match code {
        Code::Native(operation) => operation(input),
        Code::Compose(first, second) => execute(second, execute(first, input)),
        Code::Tensor(left, right) => match input {
            Datum::Pair(a, b) => pair(execute(left, *a), execute(right, *b)),
            _ => panic!("Invalid trusted tensor implementation"),
        },
        Code::Primitive(op, amount) => match (*op, input) {
            (0, value) => value,
            (1, Datum::Int(value)) => pair(Datum::Int(value), Datum::Int(value)),
            (2, Datum::Pair(a, b)) => match (*a, *b) {
                (Datum::Int(a), Datum::Int(b)) => Datum::Int(a + b),
                _ => panic!("Invalid trusted sum"),
            },
            (3, Datum::Int(value)) => {
                OWNED_OPEN.fetch_add(1, Ordering::SeqCst);
                Datum::Owned(NativeOwned { value })
            },
            (4, Datum::Owned(resource)) => {
                OWNED_FINISH.fetch_add(1, Ordering::SeqCst);
                DISPOSABLES_AT_FINISH.lock().unwrap().push(count(&DISPOSABLE_DROP));
                Datum::Int(resource.value)
            },
            (5, Datum::Int(value)) => {
                DISPOSABLE_OPEN.fetch_add(1, Ordering::SeqCst);
                Datum::Disposable(NativeDisposable { value })
            },
            (6, Datum::Disposable(resource)) => { std::mem::drop(resource); Datum::Unit },
            (7, Datum::Int(value)) => {
                DEEP_OPEN.fetch_add(1, Ordering::SeqCst);
                Datum::Deep(NativeDeep { values: vec![value] })
            },
            (8, Datum::Deep(resource)) => {
                let cloned = resource.clone();
                pair(Datum::Deep(resource), Datum::Deep(cloned))
            },
            (9, Datum::Deep(resource)) => { std::mem::drop(resource); Datum::Unit },
            (10, Datum::Deep(mut resource)) => {
                resource.values[0] += amount;
                Datum::Deep(resource)
            },
            (11, Datum::Deep(resource)) => {
                DEEP_FINISH.fetch_add(1, Ordering::SeqCst);
                Datum::Int(resource.values[0])
            },
            (12, Datum::Int(value)) => {
                SHARED_OPEN.fetch_add(1, Ordering::SeqCst);
                Datum::Shared(SharedHandle { payload: Arc::new(SharedPayload { value }) })
            },
            (13, Datum::Shared(resource)) => {
                let cloned = resource.clone();
                pair(Datum::Shared(resource), Datum::Shared(cloned))
            },
            (14, Datum::Shared(resource)) => { std::mem::drop(resource); Datum::Unit },
            (15, Datum::Shared(resource)) => Datum::Int(resource.payload.value),
            (16, Datum::Int(_)) | (17, Datum::Unit) => Datum::Unit,
            (18, Datum::Pair(a, b)) => match (*a, *b) {
                (Datum::Unit, Datum::Unit) => Datum::Unit,
                _ => panic!("Invalid trusted pair discard"),
            },
            (19, Datum::Pair(a, b)) => match *b {
                Datum::Unit => *a,
                _ => panic!("Invalid trusted K-like projection"),
            },
            (20, Datum::Unit) => Datum::Int(0),
            _ => panic!("Invalid trusted primitive implementation"),
        },
    }
}

pub fn LinearLab_Capabilities_Sub_primitive(operation: i64, amount: i64) -> Rc<Code> {
    Rc::new(Code::Primitive(operation, amount))
}
pub fn LinearLab_Capabilities_Sub_composeCode(first: Rc<Code>, second: Rc<Code>) -> Rc<Code> {
    Rc::new(Code::Compose(first, second))
}
pub fn LinearLab_Capabilities_Sub_tensorCode(left: Rc<Code>, right: Rc<Code>) -> Rc<Code> {
    Rc::new(Code::Tensor(left, right))
}
pub fn LinearLab_Capabilities_Sub_runCode(code: Rc<Code>, input: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| match execute(&code, Datum::Int(input)) {
        Datum::Int(result) => Value::Int(result),
        _ => panic!("Invalid trusted execution boundary"),
    })))
}

pub fn verify_counts() {
    assert_eq!((count(&OWNED_OPEN), count(&OWNED_FINISH), count(&OWNED_DROP)), (2, 2, 2));
    assert_eq!((count(&DISPOSABLE_OPEN), count(&DISPOSABLE_DROP)), (3, 3));
    // K-like disposal happened before the following finish, not at exit.
    assert_eq!(*DISPOSABLES_AT_FINISH.lock().unwrap(), vec![1, 2]);
    assert_eq!((count(&DEEP_OPEN), count(&DEEP_CLONE), count(&DEEP_FINISH), count(&DEEP_DROP)), (2, 1, 2, 3));
    assert_eq!((count(&SHARED_OPEN), count(&SHARED_CLONE), count(&SHARED_HANDLE_DROP), count(&SHARED_PAYLOAD_DROP)), (1, 1, 2, 1));
}
