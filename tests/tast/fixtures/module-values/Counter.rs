use std::sync::atomic::{AtomicUsize, Ordering};
static INITIALIZATIONS: AtomicUsize = AtomicUsize::new(0);

pub fn ModuleInitProbe_Counter_tick() -> crate::UnknownType {
    crate::Value::Func1(purust_core::Func1::Static(|_| {
        INITIALIZATIONS.fetch_add(1, Ordering::SeqCst);
        crate::Value::Unit
    }))
}

pub fn ModuleInitProbe_Counter_readCount() -> crate::UnknownType {
    crate::Value::Func1(purust_core::Func1::Static(|_| {
        crate::mk_int(INITIALIZATIONS.load(Ordering::SeqCst) as i64)
    }))
}
