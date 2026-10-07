use std::rc::Rc;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};

static CREATED: AtomicUsize = AtomicUsize::new(0);
static CLOSED: AtomicUsize = AtomicUsize::new(0);
static READS: AtomicUsize = AtomicUsize::new(0);
static MUTATIONS: AtomicUsize = AtomicUsize::new(0);

struct Cell { bytes: Option<Vec<u8>>, active: bool, epoch: u64 }
pub struct NativeBuffer { cell: Arc<Mutex<Cell>> }
pub struct NativeView { cell: Arc<Mutex<Cell>>, epoch: u64, start: usize, len: usize }
#[derive(Debug, PartialEq)]
enum AccessError { Closed, BorrowActive, Expired }

impl NativeBuffer {
    fn new(text: &str) -> Self {
        CREATED.fetch_add(1, Ordering::SeqCst);
        Self { cell: Arc::new(Mutex::new(Cell { bytes: Some(text.as_bytes().to_vec()), active: false, epoch: 0 })) }
    }
    fn begin(&self) -> Result<(NativeView, BorrowLease), AccessError> {
        let mut cell = self.cell.lock().unwrap();
        let len = cell.bytes.as_ref().ok_or(AccessError::Closed)?.len();
        if cell.active { return Err(AccessError::BorrowActive); }
        cell.epoch += 1;
        cell.active = true;
        let view = NativeView { cell: self.cell.clone(), epoch: cell.epoch, start: 0, len };
        let lease = BorrowLease { cell: self.cell.clone(), epoch: cell.epoch };
        Ok((view, lease))
    }
    fn append(&self, suffix: &str) -> Result<(), AccessError> {
        let mut cell = self.cell.lock().unwrap();
        if cell.bytes.is_none() { return Err(AccessError::Closed); }
        if cell.active { return Err(AccessError::BorrowActive); }
        cell.bytes.as_mut().unwrap().extend_from_slice(suffix.as_bytes());
        MUTATIONS.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}
impl NativeView {
    fn checksum(&self) -> Result<i64, AccessError> {
        let cell = self.cell.lock().unwrap();
        let bytes = cell.bytes.as_ref().ok_or(AccessError::Closed)?;
        if !cell.active || cell.epoch != self.epoch { return Err(AccessError::Expired); }
        // This &[u8] is a genuine native borrow, scoped to this locked call.
        // No byte buffer or String is copied by a read. Only an Int crosses FFI.
        let slice = &bytes[self.start..self.start + self.len];
        assert_eq!(slice.as_ptr(), bytes[self.start..].as_ptr());
        READS.fetch_add(1, Ordering::SeqCst);
        Ok(slice.iter().map(|byte| i64::from(*byte)).sum())
    }
}
struct BorrowLease { cell: Arc<Mutex<Cell>>, epoch: u64 }
impl Drop for BorrowLease {
    fn drop(&mut self) {
        let mut cell = self.cell.lock().unwrap();
        if cell.epoch == self.epoch { cell.active = false; }
    }
}
struct BufferScope { cell: Arc<Mutex<Cell>> }
impl Drop for BufferScope {
    fn drop(&mut self) {
        let mut cell = self.cell.lock().unwrap();
        if cell.bytes.take().is_some() { CLOSED.fetch_add(1, Ordering::SeqCst); }
        cell.active = false;
    }
}

pub fn LinearLab_BorrowedViews_Api_rawWithBuffer(initial: String, use_buffer: Func1<Rc<NativeBuffer>, Value>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let buffer = Rc::new(NativeBuffer::new(&initial));
        let _scope = BufferScope { cell: buffer.cell.clone() };
        use_buffer(buffer).unwrap_func1()(Value::Unit)
    })))
}
pub fn LinearLab_BorrowedViews_Api_rawWithView(buffer: Rc<NativeBuffer>, use_view: Func1<Rc<NativeView>, Value>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        let (view, _lease) = buffer.begin().expect("borrow state violated at native boundary");
        use_view(Rc::new(view)).unwrap_func1()(Value::Unit)
    })))
}
pub fn LinearLab_BorrowedViews_Api_rawChecksum(view: Rc<NativeView>) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        Value::Int(view.checksum().expect("stale native view"))
    })))
}
pub fn LinearLab_BorrowedViews_Api_rawAppend(buffer: Rc<NativeBuffer>, suffix: String) -> Value {
    Value::Func1(Func1::Shared(Rc::new(move |_| {
        buffer.append(&suffix).expect("mutation while a view is active");
        Value::Unit
    })))
}

// Called only by the test FFI. These bypass the PS indices deliberately and
// check the dynamic backstop; their rejection is NOT a PureScript proof.
pub fn verify_native_backstop() {
    assert_eq!(CREATED.load(Ordering::SeqCst), 2);
    assert_eq!(CLOSED.load(Ordering::SeqCst), 2);
    assert_eq!(READS.load(Ordering::SeqCst), 6);
    assert_eq!(MUTATIONS.load(Ordering::SeqCst), 2);
    let buffer = NativeBuffer::new("ab");
    let scope = BufferScope { cell: buffer.cell.clone() };
    let (old, lease) = buffer.begin().unwrap();
    assert_eq!(old.checksum(), Ok(195));
    assert_eq!(buffer.append("c"), Err(AccessError::BorrowActive));
    assert!(matches!(buffer.begin(), Err(AccessError::BorrowActive)));
    // This is a real native thread even in normal mode; only the native Arc
    // owner crosses the thread, never a non-threaded PureScript closure.
    let worker = NativeBuffer { cell: buffer.cell.clone() };
    assert_eq!(std::thread::spawn(move || worker.append("x")).join().unwrap(), Err(AccessError::BorrowActive));
    drop(lease);
    assert_eq!(old.checksum(), Err(AccessError::Expired));
    buffer.append("c").unwrap();
    let (current, lease) = buffer.begin().unwrap();
    assert_eq!(current.checksum(), Ok(294));
    assert_eq!(old.checksum(), Err(AccessError::Expired));
    drop(lease);
    drop(scope);
    assert_eq!(old.checksum(), Err(AccessError::Closed));
    assert_eq!(buffer.append("d"), Err(AccessError::Closed));
    println!("NATIVE_GUARDS_OK active-mutation=blocked thread-mutation=blocked stale=blocked closed=blocked");
}
