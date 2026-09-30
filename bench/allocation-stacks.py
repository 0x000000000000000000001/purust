#!/usr/bin/env python3
"""Attribute allocation requests to stacks in one combined pass.

This diagnostic copies the generated workspace and retains its eager driver.
Backtrace capture is deliberately outside allocation accounting: the TLS guard
is entered before either symbolization or the stack map is initialized. Times
from this binary are never benchmark cells.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

from instrument import ALLOCATOR
from paired import validate, validate_samples


HELPERS = '''
pub static JSON_TRACE_ENABLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
thread_local! { static JSON_TRACING: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
static JSON_STACKS: std::sync::OnceLock<std::sync::Mutex<std::collections::BTreeMap<String, (u64, u64)>>> = std::sync::OnceLock::new();
pub fn json_trace_allocation(bytes: usize) {
    if !JSON_TRACE_ENABLED.load(std::sync::atomic::Ordering::Relaxed) { return; }
    if JSON_TRACING.with(|guard| guard.replace(true)) { return; }
    let trace = std::backtrace::Backtrace::force_capture().to_string();
    let mut stacks = JSON_STACKS.get_or_init(Default::default).lock().unwrap();
    let counts = stacks.entry(trace).or_default();
    counts.0 += 1;
    counts.1 += bytes as u64;
    drop(stacks);
    JSON_TRACING.with(|guard| guard.set(false));
}
fn json_trace_finish() {
    JSON_TRACE_ENABLED.store(false, std::sync::atomic::Ordering::Relaxed);
    let stacks = JSON_STACKS.get().expect("allocation stacks").lock().unwrap();
    for (index, (trace, (count, bytes))) in stacks.iter().enumerate() {
        eprintln!("JSON_STACK {} {} {}\\n{}JSON_STACK_END", index, count, bytes, trace);
    }
}
'''

COUNTING = '''
use std::alloc::{GlobalAlloc, Layout};
struct Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        Purs_Test_JsonDecoding::json_trace_allocation(layout.size());
        mimalloc::MiMalloc.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { mimalloc::MiMalloc.dealloc(ptr, layout) }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        Purs_Test_JsonDecoding::json_trace_allocation(size);
        mimalloc::MiMalloc.realloc(ptr, layout, size)
    }
}
#[global_allocator]
static GLOBAL: Counting = Counting;
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    source = Path(args.workspace).resolve()
    work = Path(args.output).resolve()
    work.mkdir(parents=True, exist_ok=False)
    project = work / 'rust-project'
    shutil.copytree(source / 'rust/rust-project', project, ignore=shutil.ignore_patterns('target'))
    inputs = {str(path.relative_to(project)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in project.rglob('*') if path.is_file() and path.suffix in {'.rs', '.toml', '.lock'}}
    lib = project / 'Purs_Test_JsonDecoding/src/lib.rs'
    text = lib.read_text()
    start = '                let start = Instant::now();'
    end = '                let elapsed = start.elapsed().as_nanos() as f64 / 1000.0;'
    if text.count(start) != 1 or text.count(end) != 1:
        raise SystemExit('canonical timing anchors changed')
    text = text.replace(start, '''
                let trace_pass = phase.as_str() == "combined" && pass == 2;
                JSON_TRACE_ENABLED.store(trace_pass, std::sync::atomic::Ordering::Relaxed);
''' + start).replace(end, end + '''
                if trace_pass { json_trace_finish(); }
''')
    lib.write_text(text + HELPERS)
    main_rs = project / 'src/main.rs'
    text = main_rs.read_text()
    if text.count(ALLOCATOR) != 1:
        raise SystemExit('canonical allocator anchor changed')
    main_rs.write_text(text.replace(ALLOCATOR, COUNTING))
    env = dict(os.environ, CARGO_PROFILE_RELEASE_OPT_LEVEL='3', CARGO_PROFILE_RELEASE_DEBUG='1')
    with (work / 'build.log').open('w') as log:
        subprocess.run(['cargo', 'build', '--offline', '--release', '--bin', 'purust_output'],
                       cwd=project, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    corpus = source / 'corpus.json'
    expected_path = source / 'expected.json'
    expected = json.loads(expected_path.read_text())
    env.update(DIAG_CORPUS=str(corpus), DIAG_PHASES='parse,decode,combined')
    binary = project / 'target/release/purust_output'
    result = subprocess.run([str(binary)], env=env, capture_output=True, text=True, check=True, timeout=180)
    (work / 'run.log').write_text(result.stdout + '\n' + result.stderr)
    report = json.loads(result.stdout.splitlines()[-1])
    validate(report, expected)
    validate_samples(report)
    stacks = []
    for section in result.stderr.split('JSON_STACK_END'):
        section = section.strip()
        if not section:
            continue
        header, trace = section.split('\n', 1)
        prefix, index, count, size = header.split()
        if prefix != 'JSON_STACK':
            raise SystemExit('unexpected stack report')
        stacks.append({'index': int(index), 'allocs': int(count), 'bytes': int(size), 'stack': trace})
    if not stacks:
        raise SystemExit('no allocation stacks captured')
    stacks.sort(key=lambda entry: entry['allocs'], reverse=True)
    summary = {key: sum(entry[key] for entry in stacks) for key in ['allocs', 'bytes']}
    manifest = {'scope': 'allocation/reallocation requests in the first measured combined pass',
                'timing': 'diagnostic only; stack capture perturbs execution',
                'summary': summary, 'stacks': stacks, 'generated_inputs_sha256': inputs,
                'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest(),
                'corpus_sha256': hashlib.sha256(corpus.read_bytes()).hexdigest(),
                'expected_sha256': hashlib.sha256(expected_path.read_bytes()).hexdigest()}
    (work / 'profile.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
