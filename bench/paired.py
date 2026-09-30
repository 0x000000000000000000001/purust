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
import itertools
import json
import os
import statistics
import subprocess
import sys
from pathlib import Path

PHASES = ['parse', 'decode', 'combined']
DEFAULT_EXPECTED = Path('/Users/0x1/Documents/htdocs/altbak.pub/test/fixtures/json-decoding/expected.json')
RUST_BINARY = 'rust/rust-project/target/release/purust_output'


def run_binary(binary, corpus, order, cwd=None):
    env = dict(os.environ, DIAG_CORPUS=str(corpus), DIAG_PHASES=','.join(order))
    result = subprocess.run([str(binary)], cwd=cwd, env=env, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f'{binary} failed:\n{result.stderr[-2000:]}')
    lines = [line for line in result.stdout.splitlines() if line.startswith('{')]
    if not lines:
        raise SystemExit(f'{binary} printed no report')
    return json.loads(lines[-1])


def validate(report, expected):
    for key in ('fingerprints', 'json_fingerprints', 'names', 'modules', 'timed_cases'):
        if key in expected and report.get(key) != expected[key]:
            raise SystemExit(f'oracle mismatch in {key}')
    if set(report.get('phases', {})) != set(PHASES):
        raise SystemExit('report phases differ from the protocol')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--corpus', default=os.environ.get('DIAG_CORPUS'))
    parser.add_argument('--expected', default=str(DEFAULT_EXPECTED))
    parser.add_argument('--go', default=None)
    parser.add_argument('--c', default=None)
    parser.add_argument('--runs', type=int, default=1)
    parser.add_argument('--skip-rust', action='store_true')
    args = parser.parse_args()

    workspace = Path(args.workspace)
    if not args.corpus:
        raise SystemExit('pass --corpus or set DIAG_CORPUS')
    expected = json.loads(Path(args.expected).read_text())

    binaries = {}
    if not args.skip_rust:
        binaries['rust'] = workspace / RUST_BINARY
    if args.go:
        binaries['go'] = Path(args.go)
    if args.c:
        binaries['c'] = Path(args.c)

    runs = {name: [] for name in binaries}
    corpus_path = args.corpus
    for _ in range(args.runs):
        for index, order in enumerate(itertools.permutations(PHASES)):
            for name in (['go', 'rust', 'c'] if index % 2 == 0 else ['c', 'rust', 'go']):
                if name not in binaries:
                    continue
                report = run_binary(binaries[name], corpus_path, order)
                # The C reference reports its phases without the oracle fields.
                if name != 'c':
                    validate(report, expected)
                runs[name].append(report)

    medians = {}
    for name, reports in runs.items():
        if not reports:
            continue
        medians[name] = {phase: statistics.median(r['phases'][phase]['time_us'] for r in reports) for phase in PHASES}
    print(json.dumps(medians, indent=2))


if __name__ == '__main__':
    main()
