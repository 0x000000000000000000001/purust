// Promise reactions run at a checkpoint, never on the resolving worker's stack.
// Synchronous Aff turns may run concurrently; a checkpoint waits until they end.
use std::rc::Rc;
use std::collections::VecDeque;
use std::sync::{Condvar, Mutex};

type Job = Box<dyn FnOnce() + 'static>;
struct State {
    jobs: VecDeque<Job>,
    checks: VecDeque<Job>,
    turns: usize,
    draining: bool,
}
pub struct Queue {
    state: Mutex<State>,
    idle: Condvar,
    wake: Box<dyn Fn() + 'static>,
}
thread_local! {
    static CURRENT: std::cell::RefCell<Option<Rc<Queue>>> = const { std::cell::RefCell::new(None) };
    static TURN: std::cell::RefCell<Option<Rc<Queue>>> = const { std::cell::RefCell::new(None) };
}
pub struct Scope(Option<Rc<Queue>>);
impl Scope {
    pub fn enter(queue: Rc<Queue>) -> Self {
        Self(CURRENT.with(|current| current.replace(Some(queue))))
    }
}
impl Drop for Scope {
    fn drop(&mut self) { CURRENT.with(|current| current.replace(self.0.take())); }
}
pub fn current() -> Rc<Queue> {
    CURRENT.with(|current| current.borrow().clone()).expect("Promise requires a purust microtask scope")
}
struct Turn {
    queue: Rc<Queue>,
    previous: Option<Rc<Queue>>,
    checkpoint: bool,
}
impl Drop for Turn {
    fn drop(&mut self) {
        TURN.with(|current| current.replace(self.previous.take()));
        let mut state = self.queue.state.lock().unwrap();
        if self.checkpoint { state.draining = false; } else { state.turns -= 1; }
        let wake = (!state.jobs.is_empty() || !state.checks.is_empty()) && state.turns == 0;
        drop(state);
        self.queue.idle.notify_all();
        if wake { (self.queue.wake)(); }
    }
}
impl Queue {
    pub fn new(wake: impl Fn() + 'static) -> Rc<Self> {
        Rc::new(Self { state: Mutex::new(State { jobs: VecDeque::new(), checks: VecDeque::new(), turns: 0, draining: false }),
            idle: Condvar::new(), wake: Box::new(wake) })
    }
    pub fn enqueue(&self, job: impl FnOnce() + 'static) {
        self.state.lock().unwrap().jobs.push_back(Box::new(job));
        (self.wake)();
    }
    pub fn after_checkpoint(&self, check: impl FnOnce() + 'static) {
        self.state.lock().unwrap().checks.push_back(Box::new(check));
        (self.wake)();
    }
    pub fn turn<R>(self: &Rc<Self>, action: impl FnOnce() -> R) -> R {
        let _scope = Scope::enter(self.clone());
        if TURN.with(|current| current.borrow().as_ref().is_some_and(|queue| Rc::ptr_eq(queue, self))) {
            return action();
        }
        let mut state = self.state.lock().unwrap();
        while state.draining { state = self.idle.wait(state).unwrap(); }
        state.turns += 1;
        drop(state);
        let _turn = Turn { queue: self.clone(), checkpoint: false,
            previous: TURN.with(|current| current.replace(Some(self.clone()))) };
        action()
    }
    // A busy turn wakes the executor on exit. Do not block the executor here.
    pub fn drain(self: &Rc<Self>) {
        let mut state = self.state.lock().unwrap();
        if state.draining || state.turns != 0 || (state.jobs.is_empty() && state.checks.is_empty()) { return; }
        state.draining = true;
        drop(state);
        let _scope = Scope::enter(self.clone());
        let _turn = Turn { queue: self.clone(), checkpoint: true,
            previous: TURN.with(|current| current.replace(Some(self.clone()))) };
        loop {
            let job = {
                let mut state = self.state.lock().unwrap();
                state.jobs.pop_front().or_else(|| state.checks.pop_front())
            };
            match job { Some(job) => job(), None => break }
        }
    }
    pub fn has_jobs(&self) -> bool {
        let state = self.state.lock().unwrap();
        !state.jobs.is_empty() || !state.checks.is_empty()
    }
}
pub fn run_main<R>(main: impl FnOnce() -> R) -> R {
    let queue = Queue::new(|| {});
    let result = queue.turn(main);
    queue.drain();
    result
}

// ---------------------------------------------------------------------------
// Process exit code and uncaught exceptions
// ---------------------------------------------------------------------------

const EXIT_CODE_UNSET: i32 = i32::MIN;
static EXIT_CODE: std::sync::atomic::AtomicI32 =
    std::sync::atomic::AtomicI32::new(EXIT_CODE_UNSET);

/// `process.exitCode = n`: honoured when the program finishes on its own.
pub fn set_exit_code(code: i32) {
    EXIT_CODE.store(code, std::sync::atomic::Ordering::SeqCst);
}

pub fn exit_code() -> Option<i32> {
    let code = EXIT_CODE.load(std::sync::atomic::Ordering::SeqCst);
    if code == EXIT_CODE_UNSET { None } else { Some(code) }
}

/// Flushes the stdio buffers and terminates with the stored exit code.
pub fn finish_process() -> ! {
    use std::io::Write;
    let _ = std::io::stdout().flush();
    let _ = std::io::stderr().flush();
    std::process::exit(exit_code().unwrap_or(0));
}

thread_local! {
    static UNCAUGHT_HANDLER: std::cell::RefCell<Option<Box<dyn Fn()>>> = const { std::cell::RefCell::new(None) };
}

/// `process.setUncaughtExceptionCaptureCallback`: the handler runs when an
/// exception escapes the program, before the runtime re-raises it.
pub fn set_uncaught_handler(handler: Option<Box<dyn Fn()>>) {
    UNCAUGHT_HANDLER.with(|current| *current.borrow_mut() = handler);
}

/// Catches an exception that escaped the program and gives the capture
/// callback a chance to run. A callback that returns cannot resume the
/// interrupted computation, so the exception is re-raised and the runtime
/// keeps its non-zero status; a callback that terminates picks the status.
pub fn run_program_guarded<R>(main: impl FnOnce() -> R) -> R {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(main)) {
        Ok(value) => value,
        Err(payload) => {
            let handler = UNCAUGHT_HANDLER.with(|current| current.borrow_mut().take());
            if let Some(handler) = handler {
                handler();
            }
            std::panic::resume_unwind(payload);
        }
    }
}
