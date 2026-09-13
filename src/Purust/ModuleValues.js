// Typed storage is local to each binding. The small shared wait graph contains
// only thread/cell identities, never PureScript values or callbacks.
export const runtime = String.raw`
pub mod module_values {
    use std::collections::HashMap;
    use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
    use std::sync::{Condvar, Mutex, OnceLock};
    use std::thread::{self, ThreadId};

    enum State { Empty, Running(ThreadId), Ready, Poisoned }
    struct Wait { owner: ThreadId, cell: usize }
    static WAITS: OnceLock<Mutex<HashMap<ThreadId, Wait>>> = OnceLock::new();

    fn waits() -> &'static Mutex<HashMap<ThreadId, Wait>> {
        WAITS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    struct Waiting { thread: ThreadId }
    impl Waiting {
        // Called with this cell's state locked, so its owner cannot complete
        // between registering the edge and entering the condition-variable wait.
        fn enter(thread: ThreadId, owner: ThreadId, cell: usize) -> Option<Self> {
            let mut graph = waits().lock().unwrap();
            let mut next = owner;
            loop {
                if next == thread { return None; }
                match graph.get(&next) {
                    Some(wait) => next = wait.owner,
                    None => break,
                }
            }
            graph.insert(thread, Wait { owner, cell });
            Some(Self { thread })
        }
    }
    impl Drop for Waiting {
        fn drop(&mut self) { waits().lock().unwrap().remove(&self.thread); }
    }

    pub struct Cell<T> {
        value: OnceLock<T>,
        state: Mutex<State>,
        ready: Condvar,
    }
    impl<T> Cell<T> {
        pub const fn new() -> Self {
            Self { value: OnceLock::new(), state: Mutex::new(State::Empty), ready: Condvar::new() }
        }

        pub fn get_or_init(&self, name: &'static str, init: impl FnOnce() -> T) -> &T {
            if let Some(value) = self.value.get() { return value; }
            let current = thread::current().id();
            let key = self as *const Self as usize;
            let mut state = self.state.lock().unwrap();
            loop {
                match *state {
                    State::Ready => return self.value.get().unwrap(),
                    State::Poisoned => {
                        drop(state);
                        panic!("module value initialization previously failed: {}", name);
                    }
                    State::Running(owner) => {
                        let waiting = match Waiting::enter(current, owner, key) {
                            Some(waiting) => waiting,
                            None => {
                                drop(state);
                                panic!("cyclic module value initialization: {}", name);
                            }
                        };
                        state = self.ready.wait(state).unwrap();
                        drop(waiting);
                    }
                    State::Empty => { *state = State::Running(current); break; }
                }
            }
            drop(state);
            // No state/graph mutex is held while executing user code, cloning
            // its result, or unwinding its destructors. Failure is permanent:
            // callers never silently replay a partially executed initializer.
            let outcome = catch_unwind(AssertUnwindSafe(init));
            let failure = match outcome {
                Ok(value) => {
                    assert!(self.value.set(value).is_ok(), "module value initialized twice");
                    None
                }
                Err(error) => Some(error),
            };
            let mut state = self.state.lock().unwrap();
            *state = if failure.is_some() { State::Poisoned } else { State::Ready };
            // Remove completed dependencies before this owner can start another
            // initialization. Otherwise stale wait edges could report a cycle.
            waits().lock().unwrap().retain(|_, wait| wait.cell != key);
            self.ready.notify_all();
            drop(state);
            if let Some(error) = failure { resume_unwind(error); }
            self.value.get().unwrap()
        }
    }
}
`;
