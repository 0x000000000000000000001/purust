#!/usr/bin/env python3
"""Build a separate diagnostic with ordinary PS fingerprinting inside timing.

Compares eager representations with their consumers included. These timings
are not the published JsonDecoding cell. Run paired.py on the produced Rust
binaries; its exact oracle validation is unchanged.
"""
import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True, help='Canonical build-json workspace')
    parser.add_argument('--output', required=True, help='Fresh diagnostic directory')
    parser.add_argument('--boxed', action='store_true', help='Use ordinary record layouts')
    args = parser.parse_args()
    compiler = Path(__file__).resolve().parents[1]
    harness = compiler.parents[1] / 'altbak.pub/bin/benchmark/json-diagnostic.py'
    spec = importlib.util.spec_from_file_location('diagnostic', harness)
    diagnostic = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(diagnostic)
    source = Path(args.workspace).resolve() / 'rust'
    work = Path(args.output).resolve()
    work.mkdir(parents=True, exist_ok=False)
    shutil.copytree(source / 'src', work / 'src')
    for name in ['spago.yaml', 'spago.lock']:
        shutil.copy2(source / name, work / name)
    (work / '.spago').symlink_to(source / '.spago', target_is_directory=True)
    driver = work / 'src/Test/JsonDecoding.rs'
    text = driver.read_text()
    changes = {
        'results.push(result);': '''let output = if phase.as_str() == "parse" { encode(result) } else { fingerprint(result) };
                    results.push(crate::Value::String(output));''',
        '(encode(result), &expected_json[index])': '(result.unwrap_string(), &expected_json[index])',
        '(fingerprint(result), &expected_ast[index])': '(result.unwrap_string(), &expected_ast[index])',
    }
    for before, after in changes.items():
        if text.count(before) != 1:
            raise SystemExit(f'Canonical driver changed: {before}')
        text = text.replace(before, after)
    driver.write_text(text)
    project = work / 'rust-project'
    commands = [
        ['spago', 'build'],
        [str(compiler / 'bin/purust'), '--main', 'Test.JsonDecoding', '--source', 'output', '--out', str(project)]
        + (['--no-json-layouts'] if args.boxed else []),
        ['cargo', 'build', '--release', '--manifest-path', str(project / 'Cargo.toml'), '--bin', 'purust_output'],
    ]
    env = diagnostic.environment()
    env.update(CARGO_PROFILE_RELEASE_OPT_LEVEL='3', CARGO_PROFILE_RELEASE_DEBUG='false')
    for index, command in enumerate(commands):
        with (work / f'{index}-build.log').open('w') as log:
            subprocess.run(command, cwd=work, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    binary = project / 'target/release/purust_output'
    manifest = {
        'scope': 'parse/decode/combined + complete PS encode/fingerprint inside timing',
        'boxed': args.boxed,
        'commands': commands,
        'release': {'opt-level': 3, 'debug': False},
        'sha256': {str(path): hashlib.sha256(path.read_bytes()).hexdigest()
                   for path in [binary, driver, compiler / 'bin/purust.js', work / 'src/Test/JsonDecoding.purs']},
    }
    (work / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(binary)


if __name__ == '__main__':
    main()
