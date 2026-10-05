use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};

static OPENED: AtomicUsize = AtomicUsize::new(0);
static FINISHED: AtomicUsize = AtomicUsize::new(0);
static DROPPED: AtomicUsize = AtomicUsize::new(0);

// This native resource has ordinary Rust methods, no Clone and no Copy.
struct Session { value: i64 }
impl Session {
    fn new(value: i64) -> Self { OPENED.fetch_add(1, Ordering::SeqCst); Self { value } }
    fn inspect(&self) -> i64 { self.value }
    fn add(&mut self, amount: i64) { self.value += amount; }
    fn finish(self) -> i64 { FINISHED.fetch_add(1, Ordering::SeqCst); self.value }
}
impl Drop for Session {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

// Resources stay native; PureScript receives scope/key handles, not Sessions.
// Mutex also makes the adapter compatible with purust's threaded runtime.
pub struct Arena { sessions: Mutex<HashMap<String, Session>> }

pub fn LinearLab_Indexed_Api_newArena() -> Value {
    Value::Func1(Func1::Static(|_| {
        let arena = Rc::new(Arena { sessions: Mutex::new(HashMap::new()) });
        Value::Class(Rc::new(arena))
    }))
}
pub fn LinearLab_Indexed_Api_rawOpen(arena: Rc<Arena>, key: String, value: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert!(arena.sessions.lock().unwrap().insert(key.clone(), Session::new(value)).is_none());
        Value::Unit
    })))
}
pub fn LinearLab_Indexed_Api_rawInspect(arena: Rc<Arena>, key: String) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        Value::Int(arena.sessions.lock().unwrap().get(&key).unwrap().inspect())
    })))
}
pub fn LinearLab_Indexed_Api_rawAdd(arena: Rc<Arena>, key: String, amount: i64) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        arena.sessions.lock().unwrap().get_mut(&key).unwrap().add(amount);
        Value::Unit
    })))
}
pub fn LinearLab_Indexed_Api_rawFinish(arena: Rc<Arena>, key: String) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let session = arena.sessions.lock().unwrap().remove(&key).unwrap();
        Value::Int(session.finish())
    })))
}
pub fn LinearLab_Indexed_Api_checkEmpty(arena: Rc<Arena>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        assert!(arena.sessions.lock().unwrap().is_empty());
        Value::Unit
    })))
}

pub fn verify_counts() {
    assert_eq!(OPENED.load(Ordering::SeqCst), 4);
    assert_eq!(FINISHED.load(Ordering::SeqCst), 4);
    assert_eq!(DROPPED.load(Ordering::SeqCst), 4);
}
