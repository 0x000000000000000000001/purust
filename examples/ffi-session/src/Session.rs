// Ordinary Rust resource implementation. No purust types in this module.
mod native {
    use std::sync::atomic::{AtomicUsize, Ordering};

    static CREATED: AtomicUsize = AtomicUsize::new(0);
    static FINISHED: AtomicUsize = AtomicUsize::new(0);
    static DROPPED: AtomicUsize = AtomicUsize::new(0);

    // Deliberately neither Copy nor Clone.
    pub struct Session {
        id: usize,
        value: i64,
    }

    impl Session {
        pub fn open(value: i64) -> Self {
            let id = CREATED.fetch_add(1, Ordering::SeqCst) + 1;
            println!("OPEN session={id}");
            Self { id, value }
        }

        pub fn add(&mut self, amount: i64) {
            self.value += amount;
        }

        pub fn inspect(&self) {
            println!("READ session={} value={}", self.id, self.value);
        }

        pub fn finish(self) -> i64 {
            FINISHED.fetch_add(1, Ordering::SeqCst);
            println!("FINISH session={} value={}", self.id, self.value);
            self.value
        }
    }

    impl Drop for Session {
        fn drop(&mut self) {
            DROPPED.fetch_add(1, Ordering::SeqCst);
        }
    }

    pub fn counts() -> (usize, usize, usize) {
        (
            CREATED.load(Ordering::SeqCst),
            FINISHED.load(Ordering::SeqCst),
            DROPPED.load(Ordering::SeqCst),
        )
    }
}

#[derive(Clone)]
enum Operation {
    Add(i64),
    Inspect,
}

// Shared plans describe operations; they never contain a native Session.
pub struct Plan {
    operations: Vec<Operation>,
}

use std::rc::Rc;

pub fn Session_emptyPlan(_: ()) -> Rc<Plan> {
    Rc::new(Plan { operations: vec![] })
}

pub fn Session_addPlan(amount: i64) -> Rc<Plan> {
    Rc::new(Plan { operations: vec![Operation::Add(amount)] })
}

pub fn Session_inspectPlan(_: ()) -> Rc<Plan> {
    Rc::new(Plan { operations: vec![Operation::Inspect] })
}

pub fn Session_appendPlan(left: Rc<Plan>, right: Rc<Plan>) -> Rc<Plan> {
    let mut operations = left.operations.clone();
    operations.extend_from_slice(&right.operations);
    Rc::new(Plan { operations })
}

pub fn Session_runPlan(initial: i64, plan: Rc<Plan>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        // Allocation belongs inside the Effect: replay gets a new resource.
        let mut session = native::Session::open(initial);
        for operation in &plan.operations {
            match operation {
                Operation::Add(amount) => session.add(*amount),
                Operation::Inspect => session.inspect(),
            }
        }
        // No shared Session, Option::take, consumed flag or reuse check.
        Value::Int(session.finish())
    })))
}

// Diagnostics for the executable example, not part of the PureScript API.
pub fn verify_session_counts(expected: usize) {
    assert_eq!(native::counts(), (expected, expected, expected));
    println!("FFI_SESSION_POC_OK sessions={expected}");
}
