use std::sync::atomic::{AtomicUsize, Ordering};
use Purs_LinearLab_Capabilities_Sub::{Datum, native_code, foreign_value, take_foreign};

// Current purust FFI convention for a foreign Sub value. Only the reusable
// instruction description is shared here, never an Attachment resource.
fn arrow(operation: fn(Datum) -> Datum) -> Value {
    Value::ClassShared(native_code(operation))
}

static OPENED: AtomicUsize = AtomicUsize::new(0);
static CLOSED: AtomicUsize = AtomicUsize::new(0);
static DISCARDED: AtomicUsize = AtomicUsize::new(0);
static DROPPED: AtomicUsize = AtomicUsize::new(0);

// A genuinely new non-Clone native owner. It travels through the library's
// erased owned slot, never through a cloneable PureScript Value wrapper.
struct Attachment { bytes: Vec<u8> }
impl std::ops::Drop for Attachment {
    fn drop(&mut self) { DROPPED.fetch_add(1, Ordering::SeqCst); }
}

pub fn LinearLab_Capabilities_ForeignExample_attach() -> Value {
    arrow(|input| match input {
        Datum::Int(size) => {
            OPENED.fetch_add(1, Ordering::SeqCst);
            foreign_value(Attachment { bytes: vec![1; usize::try_from(size).unwrap()] })
        },
        _ => panic!("Invalid attach signature"),
    })
}
pub fn LinearLab_Capabilities_ForeignExample_appendByte() -> Value {
    arrow(|input| {
        let mut attachment: Attachment = take_foreign(input);
        attachment.bytes.push(2);
        foreign_value(attachment)
    })
}
pub fn LinearLab_Capabilities_ForeignExample_sizeAndClose() -> Value {
    arrow(|input| {
        let attachment: Attachment = take_foreign(input);
        CLOSED.fetch_add(1, Ordering::SeqCst);
        Datum::Int(attachment.bytes.len() as i64)
    })
}
pub fn LinearLab_Capabilities_ForeignExample_discardAttachment() -> Value {
    arrow(|input| {
        let attachment: Attachment = take_foreign(input);
        DISCARDED.fetch_add(1, Ordering::SeqCst);
        std::mem::drop(attachment);
        Datum::Unit
    })
}
pub fn verify_counts() {
    assert_eq!(OPENED.load(Ordering::SeqCst), 2);
    assert_eq!(CLOSED.load(Ordering::SeqCst), 1);
    assert_eq!(DISCARDED.load(Ordering::SeqCst), 1);
    assert_eq!(DROPPED.load(Ordering::SeqCst), 2);
}
