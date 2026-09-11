import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { threadedRust, threadedPrelude } from '../../src/Purust/Threading.js';
import { codegenPrelude } from '../../output/Purust.CodeGen/index.js';
import { empty } from '../../output/Data.Set/index.js';

const ffi = readFileSync(new URL('../../../purust-spec/src/Test/Spec/Console.rs', import.meta.url), 'utf8');
const runtime = fileURLToPath(new URL('../runtime/perceus_ptr/src/lib.rs', import.meta.url));

function source(threaded) {
  const prelude = codegenPrelude(empty);
  const body = threaded ? threadedRust(ffi) : ffi;
  return `${threaded ? threadedPrelude(prelude) : prelude}
extern crate self as purust_core;
#[path = ${JSON.stringify(runtime)}]
mod perceus_ptr;
mod test_spec_console {
    use super::*;
    ${body}
}

fn run(effect: Value) -> Value {
    effect.unwrap_func1()(Value::Unit)
}

fn main() {
    if std::env::args().nth(1).as_deref() == Some("construct") {
        let _unused = test_spec_console::Test_Spec_Console_write(String::from("must stay silent"));
        return;
    }
    if std::env::args().nth(1).as_deref() == Some("closed") {
        #[cfg(unix)] {
            extern "C" { fn close(fd: i32) -> i32; }
            // Close only this test process's stdout to exercise the real error path.
            assert_eq!(unsafe { close(1) }, 0);
            let action = test_spec_console::Test_Spec_Console_write(String::from("closed output"));
            run(action.clone()).unwrap_unit();
            run(action).unwrap_unit();
        }
        return;
    }
    let repeated = test_spec_console::Test_Spec_Console_write(String::from("repeat"));
    let empty = test_spec_console::Test_Spec_Console_write(String::new());
    let ansi = test_spec_console::Test_Spec_Console_write(String::from("\\u{1b}[31mred\\u{1b}[0m"));
    let pair = test_spec_console::Test_Spec_Console_write(purust_string_from_utf16(&[0xd83e, 0xdd80]));
    let isolated = test_spec_console::Test_Spec_Console_write(purust_string_from_utf16(&[0xd800]));

    // Constructing the effect must not write anything.
    run(repeated.clone()).unwrap_unit();
    run(repeated).unwrap_unit();
    run(empty).unwrap_unit();
    run(ansi).unwrap_unit();
    run(pair).unwrap_unit();
    run(isolated).unwrap_unit();
}
`;
}

const expected = Buffer.from('repeatrepeat\u001b[31mred\u001b[0m🦀�', 'utf8');
const directory = mkdtempSync(join(tmpdir(), 'purust-spec-console-'));
try {
  for (const threaded of [false, true]) {
    const label = threaded ? 'threaded' : 'normal';
    const sourcePath = join(directory, `${label}.rs`);
    const binaryPath = join(directory, label);
    writeFileSync(sourcePath, source(threaded));
    const rustcArgs = ['--edition=2021', '-Awarnings', sourcePath, '-o', binaryPath];
    if (threaded) rustcArgs.splice(2, 0, '--cfg', 'feature="threaded"');
    const build = spawnSync('rustc', rustcArgs, { encoding: 'utf8', timeout: 30_000 });
    assert.equal(build.status, 0, `${label} rustc: ${build.error ?? ''}\n${build.stderr}`);
    const scenarios = [['construct', Buffer.alloc(0)], ['output', expected]];
    if (process.platform !== 'win32') scenarios.push(['closed', Buffer.alloc(0)]);
    for (const [scenario, output] of scenarios) {
      const run = spawnSync(binaryPath, [scenario], { timeout: 5_000 });
      assert.equal(run.status, 0, `${label}/${scenario}: ${run.error ?? ''}\n${run.stderr}`);
      assert.deepEqual(run.stdout, output, `${label}/${scenario} stdout bytes differ`);
      assert.equal(run.stderr.length, 0, `${label}/${scenario} wrote unexpected stderr`);
    }
  }
  console.log('Test.Spec.Console.write: silent construction, replay, UTF-16/ANSI bytes and closed stdout passed in normal/threaded modes (closed stdout: Unix only).');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
