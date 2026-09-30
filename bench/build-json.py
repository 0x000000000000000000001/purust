#!/usr/bin/env python3
"""Rebuild JsonDecoding from canonical drivers, with strict exit checking.

Uses altbak.pub's official Rust build stages (spago, purust, release Cargo).
An optional snapshot preserves the executable and its manifest before the
workspace is rebuilt again. Compiler bundling is deliberately explicit.
"""
import argparse
import importlib.util
import json
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--snapshot')
    args = parser.parse_args()
    harness = Path(__file__).resolve().parents[3] / 'altbak.pub/bin/benchmark/json-diagnostic.py'
    spec = importlib.util.spec_from_file_location('diagnostic', harness)
    diagnostic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(diagnostic)
    work = Path(args.workspace).resolve()
    (work / 'logs').mkdir(parents=True, exist_ok=True)
    def inputs():
        # The multi-backend harness also fingerprints the current Go compiler.
        # This Rust-only rebuild must not be invalidated by another backend's
        # development; paired.py separately hashes the preserved Go/C binaries.
        ports = str(harness.parents[3] / 'purust') + '/'
        return {path: digest for path, digest in diagnostic.fingerprint('JsonDecoding').items()
                if path.startswith(ports) or path.startswith(str(diagnostic.fixtures('JsonDecoding')))
                or path in {str(harness), str(diagnostic.typed_purs())}
                or path in {str(p) for p in diagnostic.source_files('JsonDecoding') if p.suffix != '.go'}}
    before = inputs()
    (work / 'build-inputs.json').write_text(json.dumps(before, indent=2) + '\n')
    rust = diagnostic.build_rust(work, diagnostic.environment(), 'JsonDecoding')
    after = inputs()
    if before != after:
        raise SystemExit('Build inputs changed during compilation: ' + ', '.join(
            path for path in before.keys() | after.keys() if before.get(path) != after.get(path)))
    manifest = {'rust': rust, 'inputs': before}
    (work / 'manifest-rust.json').write_text(json.dumps(manifest, indent=2) + '\n')
    for name in ['corpus.json', 'expected.json']:
        shutil.copy2(diagnostic.fixtures('JsonDecoding') / name, work / name)
    if args.snapshot:
        destination = Path(args.snapshot).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            raise SystemExit(f'Snapshot already exists: {destination}')
        shutil.copy2(work / 'rust/rust-project/target/release/purust_output', destination)
        destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(rust, indent=2))


if __name__ == '__main__':
    main()
