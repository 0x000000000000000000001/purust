#!/usr/bin/env python3
"""Profile disjoint text-index/result stages in a copied generated workspace.

The canonical driver and timing window are retained. Each allocation belongs
to exactly one stage (index, result, outside); no nested region subtraction.
Instrumentation overhead makes these diagnostic times, not benchmark cells.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import statistics
import subprocess

from paired import validate, validate_samples
from instrument import ALLOCATOR

HELPERS = '''
pub static JSON_STAGE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(2);
pub static JSON_STAGE_NS: [std::sync::atomic::AtomicU64; 3] = [const { std::sync::atomic::AtomicU64::new(0) }; 3];
pub static JSON_STAGE_ALLOCS: [std::sync::atomic::AtomicU64; 3] = [const { std::sync::atomic::AtomicU64::new(0) }; 3];
pub static JSON_STAGE_BYTES: [std::sync::atomic::AtomicU64; 3] = [const { std::sync::atomic::AtomicU64::new(0) }; 3];
fn json_stage<T>(stage: usize, work: impl FnOnce() -> T) -> T {
    use std::sync::atomic::Ordering::Relaxed;
    let previous = JSON_STAGE.swap(stage, Relaxed);
    assert_eq!(previous, 2, "profiling stages must be disjoint");
    let start = std::time::Instant::now();
    let result = work();
    JSON_STAGE_NS[stage].fetch_add(start.elapsed().as_nanos() as u64, Relaxed);
    JSON_STAGE.store(previous, Relaxed);
    result
}
pub fn json_stage_alloc(bytes: usize) {
    use std::sync::atomic::Ordering::Relaxed;
    let stage = JSON_STAGE.load(Relaxed);
    JSON_STAGE_ALLOCS[stage].fetch_add(1, Relaxed);
    JSON_STAGE_BYTES[stage].fetch_add(bytes as u64, Relaxed);
}
'''

COUNTING = '''
use std::alloc::{GlobalAlloc, Layout};
struct Counting;
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        Purs_Test_JsonDecoding::json_stage_alloc(layout.size());
        mimalloc::MiMalloc.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) { mimalloc::MiMalloc.dealloc(ptr, layout) }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        Purs_Test_JsonDecoding::json_stage_alloc(size);
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
    project = work / 'rust-project'
    work.mkdir(parents=True, exist_ok=False)
    shutil.copytree(source / 'rust/rust-project', project, ignore=shutil.ignore_patterns('target'))
    lib = project / 'Purs_Test_JsonDecoding/src/lib.rs'
    main_rs = project / 'src/main.rs'
    inputs = {str(path.relative_to(project)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in project.rglob('*') if path.is_file() and path.suffix in {'.rs', '.toml', '.lock'}}
    text = lib.read_text()
    expression = r'(Purs_Data_Argonaut_Decode_Internal_Record::SchemaText::parse\(&input\))\.map\(\|doc\| (\w+_worker\(doc\.root\(\)(?:, &mut None)?\))\)'
    text, changed = re.subn(expression, r'json_stage(0, || \1).map(|doc| json_stage(1, || \2))', text)
    if changed < 1:
        raise SystemExit('no generated text worker found')
    start = '            for pass in 0..7 {'
    end = '                let elapsed = start.elapsed().as_nanos() as f64 / 1000.0;'
    if text.count(start) != 1 or text.count(end) != 1:
        raise SystemExit('canonical driver anchors changed')
    text = text.replace(start, start + '''
                for counters in [&JSON_STAGE_NS, &JSON_STAGE_ALLOCS, &JSON_STAGE_BYTES] {
                    for counter in counters { counter.store(0, std::sync::atomic::Ordering::Relaxed); }
                }
''').replace(end, end + '''
                let mut counters: [(u64, u64, u64); 3] = std::array::from_fn(|stage| (JSON_STAGE_NS[stage].load(std::sync::atomic::Ordering::Relaxed),
                    JSON_STAGE_ALLOCS[stage].load(std::sync::atomic::Ordering::Relaxed),
                    JSON_STAGE_BYTES[stage].load(std::sync::atomic::Ordering::Relaxed)));
                counters[2].0 = ((elapsed * 1000.0) as u64).saturating_sub(counters[0].0 + counters[1].0);
                eprintln!("STAGES {} {} {:?}", phase, pass, counters);
''')
    lib.write_text(text + HELPERS)
    text = main_rs.read_text()
    if text.count(ALLOCATOR) != 1:
        raise SystemExit('canonical allocator anchor changed')
    main_rs.write_text(text.replace(ALLOCATOR, COUNTING))
    env = dict(os.environ, CARGO_PROFILE_RELEASE_OPT_LEVEL='3', CARGO_PROFILE_RELEASE_DEBUG='false')
    with (work / 'build.log').open('w') as log:
        subprocess.run(['cargo', 'build', '--offline', '--release', '--bin', 'purust_output'],
                       cwd=project, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    corpus = source / 'corpus.json'
    expected = json.loads((source / 'expected.json').read_text())
    env.update(DIAG_CORPUS=str(corpus), DIAG_PHASES='parse,decode,combined')
    binary = project / 'target/release/purust_output'
    result = subprocess.run([str(binary)], env=env, capture_output=True, text=True, check=True)
    (work / 'run.log').write_text(result.stdout + '\n' + result.stderr)
    report = json.loads(result.stdout.splitlines()[-1])
    validate(report, expected)
    validate_samples(report)
    samples = []
    for phase, sample, values in re.findall(r'STAGES (\w+) (\d+) (\[.*\])', result.stderr):
        values = json.loads(values.replace('(', '[').replace(')', ']'))
        samples.append({'phase': phase, 'pass': int(sample), 'stages': {
            stage: dict(zip(['ns', 'allocs', 'bytes'], counters))
            for stage, counters in zip(['index', 'result', 'outside'], values)}})
    if len(samples) != 21:
        raise SystemExit('missing stage samples')
    summary = {phase: {stage: {key: statistics.median(s['stages'][stage][key] for s in samples
                                                    if s['phase'] == phase and s['pass'] >= 2)
                              for key in ['ns', 'allocs', 'bytes']}
                       for stage in ['index', 'result', 'outside']}
               for phase in ['parse', 'decode', 'combined']}
    (work / 'profile.json').write_text(json.dumps({'summary': summary, 'samples': samples,
        'report': report, 'generated_inputs_sha256': inputs,
        'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest()}, indent=2) + '\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
