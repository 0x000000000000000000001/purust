#!/usr/bin/env python3
"""Paired JSON-diagnostic protocol for purust.

Runs one or more JSON-decoding binaries through six phase-order permutations
and prints the median of the per-phase minima, like the preserved-build
campaigns of altbak.pub. Reports must carry the corpus oracle fingerprints;
parsing the trailing JSON line of stdout and checking the oracle fields keeps
the tool independent from the harness.

usage:
  python3 bench/paired.py --workspace var/json-decoding-rs \
      [--expected /path/to/expected.json] [--runs 1] \
      [--go /path/to/benchmark-go] [--c /path/to/benchmark-c]
"""
import argparse
import hashlib
import itertools
import json
import math
import os
import statistics
import subprocess
import sys
from pathlib import Path

PHASES = ['parse', 'decode', 'combined']
DEFAULT_EXPECTED = Path(__file__).resolve().parents[3] / 'altbak.pub/test/fixtures/json-decoding/expected.json'
RUST_BINARY = 'rust/rust-project/target/release/purust_output'


def run_binary(binary, corpus, order, cwd=None):
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(('GOPURS_', 'NEUTRAL_', 'DIAG_'))
           and key not in ('PPROF', 'GODEBUG', 'GOMEMLIMIT', 'GOFLAGS', 'GOEXPERIMENT', 'NODE_OPTIONS')}
    env.update(DIAG_CORPUS=str(corpus), DIAG_PHASES=','.join(order), GOMAXPROCS='1', GOGC='100', GOWORK='off')
    result = subprocess.run([str(binary)], cwd=cwd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'{binary} failed:\n{result.stderr[-2000:]}')
    lines = [line for line in result.stdout.splitlines() if line.startswith('{')]
    if not lines:
        raise SystemExit(f'{binary} printed no report')
    return json.loads(lines[-1])


def validate_samples(report):
    for phase, data in report['phases'].items():
        times = [sample['time_us'] for sample in data['samples']]
        if len(times) != 5 or any(not math.isfinite(value) or value <= 0 for value in times):
            raise SystemExit(f'invalid samples: {phase}')
        if min(times) != data['time_us']:
            raise SystemExit(f'reported time is not the sample minimum: {phase}')


def validate(report, expected):
    for key in ('fingerprints', 'json_fingerprints', 'names', 'modules', 'timed_cases'):
        if key in expected and report.get(key) != expected[key]:
            raise SystemExit(f'oracle mismatch in {key}')
    if set(report.get('phases', {})) != set(PHASES):
        raise SystemExit('report phases differ from the protocol')


def validate_c(report, expected, corpus):
    # C reproduces successful values exactly, but reports null for Argonaut
    # decoding errors. Keep the official harness's success/rejection contract.
    for key in ('json_fingerprints', 'names', 'modules', 'timed_cases'):
        if report.get(key) != expected[key]:
            raise SystemExit(f'C oracle mismatch in {key}')
    successes = {case['name'] for case in corpus if case['benchmark']}
    successes.update(('optional-fields-missing', 'optional-fields-null'))
    fingerprints = report.get('fingerprints', [])
    if len(fingerprints) != len(expected['fingerprints']):
        raise SystemExit('C oracle fingerprint count differs')
    for name, got, want in zip(expected['names'], fingerprints, expected['fingerprints']):
        if got != (want if name in successes else None):
            raise SystemExit(f'C oracle mismatch in {name}')
    if set(report.get('phases', {})) != set(PHASES):
        raise SystemExit('C report phases differ from the protocol')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--corpus', default=os.environ.get('DIAG_CORPUS'))
    parser.add_argument('--expected', default=str(DEFAULT_EXPECTED))
    parser.add_argument('--go', default=None)
    parser.add_argument('--c', default=None)
    parser.add_argument('--rust', help='Explicit candidate binary (overrides workspace binary)')
    parser.add_argument('--baseline', help='Preserved Rust baseline binary')
    parser.add_argument('--output', help='Save raw reports, hashes and medians')
    parser.add_argument('--runs', type=int, default=1)
    parser.add_argument('--skip-rust', action='store_true')
    args = parser.parse_args()
    if args.runs < 1:
        parser.error('--runs must be positive')

    workspace = Path(args.workspace).resolve()
    if not args.corpus:
        raise SystemExit('pass --corpus or set DIAG_CORPUS')
    expected = json.loads(Path(args.expected).read_text())

    binaries = {}
    if args.baseline:
        binaries['baseline'] = Path(args.baseline).resolve()
    if not args.skip_rust:
        binaries['rust'] = Path(args.rust).resolve() if args.rust else workspace / RUST_BINARY
    if args.go:
        binaries['go'] = Path(args.go).resolve()
    if args.c:
        binaries['c'] = Path(args.c).resolve()

    runs = {name: [] for name in binaries}
    corpus_path = Path(args.corpus).resolve()
    corpus = json.loads(corpus_path.read_text())
    input_hashes = {str(path): hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in [corpus_path, Path(args.expected).resolve()]}
    hashes = {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in binaries.items()}
    for _ in range(args.runs):
        for index, order in enumerate(itertools.permutations(PHASES)):
            sequence = ['go', 'baseline', 'rust', 'c']
            for name in (sequence if index % 2 == 0 else sequence[::-1]):
                if name not in binaries:
                    continue
                report = run_binary(binaries[name], corpus_path, order)
                if name == 'go' and report.get('gomaxprocs') != 1:
                    raise SystemExit('Go did not run with GOMAXPROCS=1')
                if name == 'c':
                    validate_c(report, expected, corpus)
                else:
                    validate(report, expected)
                validate_samples(report)
                runs[name].append(report)

    medians = {}
    for name, reports in runs.items():
        if not reports:
            continue
        medians[name] = {phase: statistics.median(r['phases'][phase]['time_us'] for r in reports) for phase in PHASES}
    print(json.dumps(medians, indent=2))
    for name, path in binaries.items():
        if hashlib.sha256(path.read_bytes()).hexdigest() != hashes[name]:
            raise SystemExit(f'binary changed during measurement: {name}')
    for path, digest in input_hashes.items():
        if hashlib.sha256(Path(path).read_bytes()).hexdigest() != digest:
            raise SystemExit(f'input changed during measurement: {path}')
    if args.output:
        Path(args.output).write_text(json.dumps({
            'medians': medians, 'reports': runs,
            'protocol': {'phase_orders': list(itertools.permutations(PHASES)), 'runs': args.runs,
                         'warmups_per_phase': 2, 'samples_per_phase': 5,
                         'GOMAXPROCS': 1, 'GOGC': 100, 'cell': 'median of process minima'},
            'binaries': {name: {'path': str(path), 'sha256': hashes[name]} for name, path in binaries.items()},
            'corpus_sha256': input_hashes[str(corpus_path)],
            'expected_sha256': input_hashes[str(Path(args.expected).resolve())],
        }, indent=2) + '\n')


if __name__ == '__main__':
    main()
