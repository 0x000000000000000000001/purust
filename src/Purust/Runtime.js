// Bundle canonical bytes, preserving whitespace and UTF-8 without host paths.
import { Buffer } from 'node:buffer';
import manifest from '../../tests/runtime/perceus_ptr/Cargo.toml';
import lib from '../../tests/runtime/perceus_ptr/src/lib.rs';
import local from '../../tests/runtime/perceus_ptr/src/local.rs';
import threaded from '../../tests/runtime/perceus_ptr/src/threaded.rs';
import microtasks from '../../src/Purust/Microtasks.rs';

export const microtasksSource = Buffer.from(microtasks, 'base64').toString('utf8');

export const runtimeFiles = [
  { path: 'Cargo.toml', content: manifest },
  { path: 'src/lib.rs', content: lib },
  { path: 'src/local.rs', content: local },
  { path: 'src/threaded.rs', content: threaded },
].map(({ path, content }) => ({ path, content: Buffer.from(content, 'base64').toString('utf8') }));
