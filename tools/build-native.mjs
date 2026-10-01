import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandRunner, Interrupted } from './command-runner.mjs';
import { findTypedCompiler, nativeWorkspaceConfig, verifyTypedOutput } from './native-workspace.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: npm run build:native -- [--keep-workspace]\nBootstrap bin/purust-native using the Node backend and Rust library ports.\nPURUST_PURS selects the typed purs fork; PURUST_NATIVE_TMPDIR selects the workspace parent.');
  process.exit(0);
}
if (args.some(arg => arg !== '--keep-workspace')) {
  console.error(`Unknown option: ${args.find(arg => arg !== '--keep-workspace')}`);
  process.exit(1);
}

function publish(binary) {
  const destination = join(root, 'bin/purust-native');
  const staging = mkdtempSync(join(dirname(destination), '.purust-native-'));
  try {
    const path = join(staging, 'purust-native');
    copyFileSync(binary, path);
    chmodSync(path, 0o755);
    renameSync(path, destination);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return destination;
}

const commands = new CommandRunner();
const environment = { ...process.env,
  PATH: [join(root, 'node_modules/.bin'), dirname(process.execPath), process.env.PATH ?? ''].join(delimiter) };
let workspace, stage = 'prepare';
async function run(label, command, args, cwd, env = environment) {
  commands.checkInterrupted();
  stage = label;
  const log = join(workspace, `${label}.log`), started = Date.now();
  console.log(`[${label}] ${command} ${args.join(' ')}\n  log: ${log}`);
  const status = await commands.run(command, args, { cwd, env, log });
  if (commands.signal || status.code !== 0) process.stderr.write(readFileSync(log, 'utf8'));
  commands.checkInterrupted();
  if (status.code !== 0) throw new Error(`${label} failed (${status.signal ?? status.code})`);
  console.log(`[${label}] finished in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

try {
  const compiler = findTypedCompiler(root, process.env.PURUST_PURS);
  const config = nativeWorkspaceConfig(root);
  workspace = mkdtempSync(join(process.env.PURUST_NATIVE_TMPDIR ?? tmpdir(), 'purust-native-build-'));
  writeFileSync(join(workspace, 'spago.yaml'), config);
  symlinkSync(join(root, 'src'), join(workspace, 'src'), 'dir');
  const typedBin = join(workspace, 'typed-bin');
  mkdirSync(typedBin);
  symlinkSync(compiler, join(typedBin, 'purs'));
  console.log(`Native bootstrap workspace: ${workspace}\nTAST compiler: ${compiler}`);
  await run('node-backend', 'npm', ['run', 'build'], root);
  await run('typed-corefn', 'spago', ['build'], workspace,
    { ...environment, PATH: typedBin + delimiter + environment.PATH });
  stage = 'verify-tast';
  const verified = verifyTypedOutput(join(workspace, 'output'));
  console.log(`Verified ${verified.modules} TAST modules, ${verified.types} types`);
  writeFileSync(join(workspace, 'verify-tast.log'), JSON.stringify({ compiler, ...verified }) + '\n');
  const rust = join(workspace, 'rust');
  await run('generate-rust', process.execPath, ['--expose-gc', '--stack-size=65536', '--max-old-space-size=16384',
    join(root, 'bin/purust.js'), '--source', join(workspace, 'output'), '--out', rust, '--main', 'Main', '--threaded'], workspace);
  // Rust 1.96 ThinLTO can leave LLVM 22 bitcode in these large compiler
  // archives; Apple's LLVM 17 linker cannot read it. Emit native objects.
  await run('cargo-build', 'cargo', ['build', '--release', '--config', 'profile.release.lto=false',
    '--manifest-path', join(rust, 'Cargo.toml')], workspace);
  commands.checkInterrupted();
  stage = 'publish';
  console.log(`Built ${publish(join(rust, 'target/release/purust_output'))}`);
  if (args.includes('--keep-workspace')) console.log(`Workspace retained: ${workspace}`);
  else rmSync(workspace, { recursive: true, force: true });
} catch (error) {
  console.error(`Native bootstrap failed during ${stage}: ${error.message}`);
  if (workspace) console.error(`Workspace and logs retained: ${workspace}`);
  process.exitCode = commands.signal ? new Interrupted(commands.signal).exitCode : 1;
} finally {
  commands.dispose();
}
