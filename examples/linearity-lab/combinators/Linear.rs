use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};

static OPENED: AtomicUsize = AtomicUsize::new(0);
static FINISHED: AtomicUsize = AtomicUsize::new(0);
static DROPPED: AtomicUsize = AtomicUsize::new(0);

// Real owned Rust resource: neither Clone nor Copy, no shared wrapper.
struct NativeSession { id: usize, value: i64 }
impl NativeSession {
    fn open(value: i64) -> Self {
        let id = OPENED.fetch_add(1, Ordering::SeqCst) + 1;
        println!("COMBINATOR_OPEN {id}");
        Self { id, value }
    }
    fn add(&mut self, amount: i64) { self.value += amount; }
    fn inspect(&self) { println!("COMBINATOR_READ {} {}", self.id, self.value); }
    fn finish(self) -> i64 {
        FINISHED.fetch_add(1, Ordering::SeqCst);
        println!("COMBINATOR_FINISH {} {}", self.id, self.value);
        self.value
    }
}
impl Drop for NativeSession {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

// Pure descriptions may be shared. The interpreter's data cannot be cloned.
pub enum Code {
    Primitive(i64, i64), Sequence(Rc<Code>, Rc<Code>), Tensor(Rc<Code>, Rc<Code>),
}
enum Datum { Int(i64), Session(NativeSession), Pair(Box<Datum>, Box<Datum>) }
fn pair(left: Datum, right: Datum) -> Datum { Datum::Pair(Box::new(left), Box::new(right)) }

fn execute(code: &Code, input: Datum) -> Datum {
    match code {
        Code::Sequence(left, right) => execute(right, execute(left, input)),
        Code::Tensor(left, right) => match input {
            Datum::Pair(a, b) => pair(execute(left, *a), execute(right, *b)),
            _ => panic!("Invalid trusted tensor implementation"),
        },
        Code::Primitive(operation, amount) => match (*operation, input) {
            (0, value) => value,
            (1, Datum::Pair(a, b)) => pair(*b, *a),
            (2, Datum::Pair(ab, c)) => match *ab {
                Datum::Pair(a, b) => pair(*a, pair(*b, *c)),
                _ => panic!("Invalid trusted associator implementation"),
            },
            (3, Datum::Pair(a, bc)) => match *bc {
                Datum::Pair(b, c) => pair(pair(*a, *b), *c),
                _ => panic!("Invalid trusted associator implementation"),
            },
            (4, Datum::Int(value)) => pair(Datum::Int(value), Datum::Int(value)),
            (5, Datum::Pair(a, b)) => match (*a, *b) {
                (Datum::Int(a), Datum::Int(b)) => Datum::Int(a + b),
                _ => panic!("Invalid trusted integer implementation"),
            },
            (6, Datum::Int(value)) => Datum::Session(NativeSession::open(value)),
            (7, Datum::Session(mut session)) => { session.add(*amount); Datum::Session(session) },
            (8, Datum::Session(session)) => { session.inspect(); Datum::Session(session) },
            (9, Datum::Session(session)) => Datum::Int(session.finish()),
            _ => panic!("Invalid trusted primitive implementation"),
        },
    }
}

pub fn LinearLab_Combinators_Linear_primitive(operation: i64, amount: i64) -> Rc<Code> {
    Rc::new(Code::Primitive(operation, amount))
}
pub fn LinearLab_Combinators_Linear_sequenceCode(left: Rc<Code>, right: Rc<Code>) -> Rc<Code> {
    Rc::new(Code::Sequence(left, right))
}
pub fn LinearLab_Combinators_Linear_tensorCode(left: Rc<Code>, right: Rc<Code>) -> Rc<Code> {
    Rc::new(Code::Tensor(left, right))
}
pub fn LinearLab_Combinators_Linear_runCode(code: Rc<Code>, input: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| match execute(&code, Datum::Int(input)) {
        Datum::Int(result) => Value::Int(result),
        _ => panic!("Invalid trusted runInt implementation"),
    })))
}
pub fn verify_counts(expected: usize) {
    assert_eq!(OPENED.load(Ordering::SeqCst), expected);
    assert_eq!(FINISHED.load(Ordering::SeqCst), expected);
    assert_eq!(DROPPED.load(Ordering::SeqCst), expected);
}
