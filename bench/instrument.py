#!/usr/bin/env python3
"""Allocation profiling for a built JSON-decoding workspace.

Patches the workspace copy of the driver and of the generated binary so each
timed pass reports its allocation count and bytes, then runs the corpus (or
one single-case corpus per module) and prints the results. The workspace is
rebuilt from scratch afterwards by the harness, so patching is safe.

usage:
  python3 bench/instrument.py --workspace var/json-decoding-rs \
      --purust ../purust/bin/purust --corpus corpus.json [--single-cases DIR]
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

DRIVER = 'rust/src/Test/JsonDecoding.rs'
MAIN = 'rust/rust-project/src/main.rs'
BINARY = 'rust/rust-project/target/release/purust_output'

STATIC_MARKER = 'pub static DIAG_ALLOCS: std::sync::atomic::AtomicUsize'
STATICS = '''\nuse std::sync::atomic::Ordering;\npub static DIAG_ALLOCS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);\npub static DIAG_BYTES: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);\n'''

ALLOCATOR = '''#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;'''

COUNTING = '''use std::alloc::{GlobalAlloc, Layout};
use std::sync::atomic::Ordering;

struct Counting;

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        Purs_Test_JsonDecoding::DIAG_ALLOCS.fetch_add(1, Ordering::Relaxed);
        Purs_Test_JsonDecoding::DIAG_BYTES.fetch_add(layout.size(), Ordering::Relaxed);
        mimalloc::MiMalloc.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        mimalloc::MiMalloc.dealloc(ptr, layout)
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        Purs_Test_JsonDecoding::DIAG_ALLOCS.fetch_add(1, Ordering::Relaxed);
        Purs_Test_JsonDecoding::DIAG_BYTES.fetch_add(new_size, Ordering::Relaxed);
        mimalloc::MiMalloc.realloc(ptr, layout, new_size)
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;'''


def patch_driver(path):
    text = path.read_text()
    if STATIC_MARKER in text:
        return
    anchor = 'use std::time::Instant;'
    if anchor not in text:
        raise SystemExit('driver anchor missing')
    text = text.replace(anchor, anchor + '\n' + STATICS, 1)
    before = '            for pass in 0..7 {'
    if before not in text:
        raise SystemExit('pass loop anchor missing')
    text = text.replace(before, before + '''
                let __before_allocs = DIAG_ALLOCS.load(Ordering::Relaxed);
                let __before_bytes = DIAG_BYTES.load(Ordering::Relaxed);''', 1)
    after = '                let elapsed = start.elapsed().as_nanos() as f64 / 1000.0;'
    if after not in text:
        raise SystemExit('timing anchor missing')
    text = text.replace(after, after + '''
                eprintln!(
                    "DIAG phase={} pass={} allocs={} bytes={} us={:.1}",
                    phase,
                    pass,
                    DIAG_ALLOCS.load(Ordering::Relaxed) - __before_allocs,
                    DIAG_BYTES.load(Ordering::Relaxed) - __before_bytes,
                    elapsed
                );''', 1)
    path.write_text(text)


def patch_main(path):
    text = path.read_text()
    if 'struct Counting' in text:
        return
    if ALLOCATOR not in text:
        raise SystemExit('allocator anchor missing')
    path.write_text(text.replace(ALLOCATOR, COUNTING, 1))


def build(workspace, purust):
    subprocess.run([str(purust), '--main', 'Test.JsonDecoding', '--source', 'output',
                    '--out', 'rust-project'], cwd=workspace / 'rust', check=True)
    patch_main(workspace / MAIN)
    subprocess.run(['cargo', 'build', '--release'], cwd=workspace / 'rust/rust-project', check=True)


def run_case(workspace, corpus, label):
    env = {'DIAG_CORPUS': str(corpus), 'DIAG_PHASES': 'decode'}
    result = subprocess.run([str(workspace / BINARY)], env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'{label}: {result.stderr[-800:]}')
    match = re.search(r'DIAG phase=decode pass=0 allocs=(\d+) bytes=(\d+) us=([\d.]+)', result.stderr)
    if not match:
        raise SystemExit(f'{label}: no counters')
    print(f'{label}: allocs={match.group(1)} bytes={match.group(2)} us={match.group(3)}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--purust', required=True)
    parser.add_argument('--corpus', required=True)
    parser.add_argument('--single-cases', default=None)
    args = parser.parse_args()

    workspace = Path(args.workspace).resolve()
    patch_driver(workspace / DRIVER)
    build(workspace, Path(args.purust).resolve())

    corpus = json.loads(Path(args.corpus).read_text())
    if args.single_cases:
        out = Path(args.single_cases)
        out.mkdir(parents=True, exist_ok=True)
        for case in corpus:
            if not case.get('benchmark'):
                continue
            single = out / f"{case['name']}.json"
            single.write_text(json.dumps([dict(case, benchmark=True)]))
            run_case(workspace, single, case['name'])
    else:
        run_case(workspace, args.corpus, 'corpus')


if __name__ == '__main__':
    main()
