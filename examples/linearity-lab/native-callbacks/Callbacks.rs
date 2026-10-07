use std::rc::Rc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};

static CREATED: AtomicUsize = AtomicUsize::new(0);
static DROPPED: AtomicUsize = AtomicUsize::new(0);
static ONCE_CALLS: AtomicUsize = AtomicUsize::new(0);
static MUTABLE_CALLS: AtomicUsize = AtomicUsize::new(0);

// Intentionally neither Clone nor Copy.
struct Session { value: i64 }
impl Session {
    fn new(value: i64) -> Self {
        CREATED.fetch_add(1, Ordering::SeqCst);
        Self { value }
    }
    fn add(&mut self, increment: i64) -> i64 {
        self.value += increment;
        self.value
    }
}
impl Drop for Session {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

type Callback = purust_core::Func1<i64, Value>;
type NativeOnce = Box<dyn FnOnce(Callback) -> Value + Send>;
pub struct Once { job: Mutex<Option<NativeOnce>> }

type NativeMutable = Box<dyn FnMut(i64, Callback) -> Value + Send>;
enum MutableState { Ready(NativeMutable), Running, Closed }
pub struct Mutable { state: Mutex<MutableState> }

// The native FnMut closure is exclusively owned by this lease during a call.
// It is outside the mutex while PureScript runs: nested calls see Running.
// Drop restores the closure even when a PureScript exception unwinds the call.
struct ActiveMutable<'a> { handle: &'a Mutable, job: Option<NativeMutable> }
impl Drop for ActiveMutable<'_> {
    fn drop(&mut self) {
        let mut state = self.handle.state.lock().unwrap();
        assert!(matches!(*state, MutableState::Running));
        *state = MutableState::Ready(self.job.take().unwrap());
    }
}

fn enter(handle: &Mutable) -> ActiveMutable<'_> {
    let mut state = handle.state.lock().unwrap();
    match std::mem::replace(&mut *state, MutableState::Running) {
        MutableState::Ready(job) => ActiveMutable { handle, job: Some(job) },
        other => {
            let message = match other {
                MutableState::Running => "mutable callback busy",
                MutableState::Closed => "mutable callback closed",
                MutableState::Ready(_) => unreachable!(),
            };
            *state = other;
            drop(state);
            fail(message)
        }
    }
}

fn fail(message: &str) -> ! {
    Purs_Effect_Exception::purust_exception_raise(
        Purs_Effect_Exception::Effect_Exception_error(message.to_owned()))
}

pub fn LinearLab_NativeCallbacks_Callbacks_newOnce(initial: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let session = Session::new(initial);
        let job: NativeOnce = Box::new(move |callback| {
            ONCE_CALLS.fetch_add(1, Ordering::SeqCst);
            let result = callback(session.value).unwrap_func1()(Value::Unit);
            // Moving session to drop makes this actual closure FnOnce-only.
            // A PureScript exception also drops session while unwinding.
            drop(session);
            result
        });
        Value::Class(Rc::new(Rc::new(Once { job: Mutex::new(Some(job)) })))
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_invokeOnce(handle: Rc<Once>, callback: Callback) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let job = handle.job.lock().unwrap().take();
        // The mutex is released before user code, including reentrant code.
        match job {
            Some(job) => job(callback.clone()),
            None => fail("once consumed"),
        }
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_discardOnce(handle: Rc<Once>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let job = handle.job.lock().unwrap().take();
        drop(job);
        Value::Unit
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_newMutable(initial: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let mut session = Session::new(initial);
        let job: NativeMutable = Box::new(move |increment, callback| {
            MUTABLE_CALLS.fetch_add(1, Ordering::SeqCst);
            // The &mut self method captures the entire Session, not just its
            // Copy field. It also requires FnMut rather than Fn.
            let value = session.add(increment);
            callback(value).unwrap_func1()(Value::Unit)
        });
        Value::Class(Rc::new(Rc::new(Mutable { state: Mutex::new(MutableState::Ready(job)) })))
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_invokeMutable(handle: Rc<Mutable>, increment: i64, callback: Callback) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let mut active = enter(&handle);
        active.job.as_mut().unwrap()(increment, callback.clone())
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_closeMutable(handle: Rc<Mutable>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let job = {
            let mut state = handle.state.lock().unwrap();
            match std::mem::replace(&mut *state, MutableState::Closed) {
                MutableState::Ready(job) => Some(job),
                MutableState::Closed => None,
                MutableState::Running => {
                    *state = MutableState::Running;
                    drop(state);
                    fail("mutable callback busy")
                },
            }
        };
        drop(job);
        Value::Unit
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_assertInt(label: String, expected: i64, actual: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert_eq!(actual, expected, "{}", purust_core::purust_string_to_utf8_lossy(&label));
        println!("PASS {}", purust_core::purust_string_to_utf8_lossy(&label));
        Value::Unit
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_assertDrops(label: String, expected: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert_eq!(DROPPED.load(Ordering::SeqCst), expected as usize,
            "{}", purust_core::purust_string_to_utf8_lossy(&label));
        println!("PASS {} drops={expected}", purust_core::purust_string_to_utf8_lossy(&label));
        Value::Unit
    })))
}

pub fn LinearLab_NativeCallbacks_Callbacks_verify() -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert_eq!(CREATED.load(Ordering::SeqCst), 6);
        assert_eq!(DROPPED.load(Ordering::SeqCst), 6);
        assert_eq!(ONCE_CALLS.load(Ordering::SeqCst), 3);
        assert_eq!(MUTABLE_CALLS.load(Ordering::SeqCst), 6);
        println!("COUNTS created=6 dropped=6 once_calls=3 mutable_calls=6");
        println!("NATIVE_CALLBACKS_OK");
        Value::Unit
    })))
}
