// Template: allocation-backtrace sampling for a purust binary.
//
// Replace the generated `#[global_allocator]` line in
// `rust-project/src/main.rs` with this block, build with
// `CARGO_PROFILE_RELEASE_DEBUG=true cargo build --release`, then run with:
//   DIAG_BT_START=<first allocation index> DIAG_BT_COUNT=<samples>
//   DIAG_BT_OUT=<file> <binary>
// and aggregate with `bench/aggregate-bt.py <file>`.
use std::alloc::{GlobalAlloc, Layout};
use std::sync::atomic::Ordering;
use std::sync::OnceLock;

struct Counting;

struct BtWindow { start: usize, limit: usize, out: Option<String> }

fn bt_window() -> &'static Option<BtWindow> {
    static WINDOW: OnceLock<Option<BtWindow>> = OnceLock::new();
    WINDOW.get_or_init(|| {
        let start = std::env::var("DIAG_BT_START").ok()?.parse().ok()?;
        let limit = std::env::var("DIAG_BT_COUNT").ok()?.parse().ok()?;
        Some(BtWindow { start, limit, out: std::env::var("DIAG_BT_OUT").ok() })
    })
}

fn maybe_capture(count: usize) {
    let Some(window) = bt_window().as_ref() else { return };
    if count < window.start || count >= window.start + window.limit { return; }
    thread_local! { static CAPTURING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
    if CAPTURING.with(|c| c.replace(true)) { return; }
    let text = format!("{}", std::backtrace::Backtrace::force_capture());
    if let Some(path) = &window.out {
        use std::io::Write;
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            let _ = writeln!(file, "=== alloc {}\n{}", count, text);
        }
    }
    CAPTURING.with(|c| c.set(false));
}

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let count = Purs_Test_JsonDecoding::DIAG_ALLOCS.fetch_add(1, Ordering::Relaxed);
        Purs_Test_JsonDecoding::DIAG_BYTES.fetch_add(layout.size(), Ordering::Relaxed);
        maybe_capture(count);
        mimalloc::MiMalloc.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        mimalloc::MiMalloc.dealloc(ptr, layout)
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        let count = Purs_Test_JsonDecoding::DIAG_ALLOCS.fetch_add(1, Ordering::Relaxed);
        Purs_Test_JsonDecoding::DIAG_BYTES.fetch_add(new_size, Ordering::Relaxed);
        maybe_capture(count);
        mimalloc::MiMalloc.realloc(ptr, layout, new_size)
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;
