use std::sync::atomic::{AtomicUsize, Ordering};

static DROPPED: AtomicUsize = AtomicUsize::new(0);
struct Session { value: i64 }
impl Session {
    fn add(&mut self, increment: i64) -> i64 {
        self.value += increment;
        self.value
    }
}
impl Drop for Session {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

fn once(value: i64) -> impl FnOnce() -> i64 {
    let session = Session { value };
    move || {
        let result = session.value;
        drop(session);
        result
    }
}

#[cfg(once_twice)]
fn main() {
    let call = once(10);
    assert_eq!(call(), 10);
    call(); // Rust must reject reuse of the moved closure itself.
}

#[cfg(mutable_as_shared)]
fn main() {
    fn requires_fn(_: impl Fn(i64) -> i64) {}
    let mut session = Session { value: 0 };
    let callback = move |increment| session.add(increment);
    requires_fn(callback); // Mutation makes this FnMut, not Fn.
}

#[cfg(not(any(once_twice, mutable_as_shared)))]
fn main() {
    assert_eq!(once(10)(), 10);
    let mut session = Session { value: 0 };
    let mut callback = move |increment| session.add(increment);
    assert_eq!(DROPPED.load(Ordering::SeqCst), 1);
    assert_eq!(callback(2), 2);
    assert_eq!(callback(2), 4);
    assert_eq!(DROPPED.load(Ordering::SeqCst), 1);
    drop(callback);
    assert_eq!(DROPPED.load(Ordering::SeqCst), 2);
    println!("RUST_CALLBACK_TRAITS_OK");
}
