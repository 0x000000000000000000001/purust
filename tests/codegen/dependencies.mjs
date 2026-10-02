import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transitiveImports } from '../../output/Purust.Dependencies/index.js';
import * as MapPS from '../../output/Data.Map/index.js';
import * as SetPS from '../../output/Data.Set/index.js';
import { ordString } from '../../output/Data.Ord/index.js';
import { foldableArray } from '../../output/Data.Foldable/index.js';
import { unfoldableArray } from '../../output/Data.Unfoldable/index.js';
import { Tuple } from '../../output/Data.Tuple/index.js';

const set = SetPS.fromFoldable(foldableArray)(ordString);
const entries = MapPS.toUnfoldable(unfoldableArray);
const values = SetPS.toUnfoldable(unfoldableArray);
function reachable(graph, name) {
  const seen = new Set(), pending = [...(graph.get(name) ?? [])];
  while (pending.length) {
    const next = pending.pop();
    if (seen.has(next)) continue;
    seen.add(next); pending.push(...(graph.get(next) ?? []));
  }
  return [...seen].sort();
}
const named = [new Map(), new Map([['A', ['B']], ['B', ['C']], ['C', []]]),
  new Map([['A', ['A']], ['B', ['A', 'Outside']]]),
  new Map([['A', ['B']], ['B', ['A']], ['Isolated', []]]),
  new Map([['Ω', ['😀', 'External']], ['😀', ['Ω', '\ud800']], ['\ud800', []]])];
const matrices = [[], [[]], [[0]], [[1], [0]], [[1, 1], []]];
let seed = 42;
const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let sample = 0; sample < 400; sample++) {
  const size = 1 + next() % 40;
  matrices.push(Array.from({ length: size }, () => Array.from({ length: next() % 8 }, () => next() % size)));
}
for (const size of [63, 64, 65, 127, 128, 129]) {
  matrices.push(Array.from({ length: size }, (_, i) => i + 1 < size ? [i + 1] : []));
  matrices.push(Array.from({ length: size }, (_, i) => [(i + 1) % size]));
}
for (const matrix of matrices) named.push(new Map(matrix.map((row, i) => [`M${i}`, row.map(j => `M${j}`)])));
for (const graph of named) {
  const input = MapPS.fromFoldable(ordString)(foldableArray)([...graph].map(([key, deps]) => new Tuple(key, set(deps))));
  const actual = entries(transitiveImports(input)).map(pair => [pair.value0, values(pair.value1)]);
  assert.deepEqual(actual, [...graph.keys()].sort().map(key => [key, reachable(graph, key)]));
}
const directory = mkdtempSync(join(tmpdir(), 'purust-dependencies-'));
try {
  const fields = [];
  const u32 = n => { const bytes = Buffer.alloc(4); bytes.writeUInt32LE(n); fields.push(bytes); };
  const encode = matrix => { u32(matrix.length); for (const row of matrix) { u32(row.length); row.forEach(u32); } };
  for (const matrix of matrices) {
    encode(matrix);
    const graph = new Map(matrix.map((row, i) => [i, row]));
    encode(matrix.map((_, i) => reachable(graph, i).sort((a, b) => a - b)));
  }
  writeFileSync(join(directory, 'cases.bin'), Buffer.concat(fields));
  writeFileSync(join(directory, 'main.rs'), `
#![allow(non_snake_case, private_interfaces)]
#[derive(Clone)]
enum Value { Int(i64), Array(Vec<Value>), IntArray(Vec<i64>) }
impl Value {
    fn array_len(&self) -> usize { match self { Self::Array(v) => v.len(), Self::IntArray(v) => v.len(), _ => panic!("array") } }
    fn array_get(&self, i: usize) -> Value { match self { Self::Array(v) => v[i].clone(), Self::IntArray(v) => Self::Int(v[i]), _ => panic!("array") } }
    fn array_get_int(&self, i: usize) -> i64 { match self.array_get(i) { Self::Int(v) => v, _ => panic!("int") } }
}
type Func1<A, B> = fn(A) -> B;
fn mk_array(values: Vec<Value>) -> Value { Value::Array(values) }
${readFileSync(new URL('../../src/Purust/Dependencies.rs', import.meta.url), 'utf8')}
fn u32(bytes: &mut &[u8]) -> usize {
    let n = u32::from_le_bytes(bytes[..4].try_into().unwrap()); *bytes = &bytes[4..]; n as usize
}
fn matrix(bytes: &mut &[u8]) -> Vec<Vec<i64>> {
    (0..u32(bytes)).map(|_| (0..u32(bytes)).map(|_| u32(bytes) as i64).collect()).collect()
}
fn main() {
    let mut bytes: &[u8] = include_bytes!("cases.bin");
    let mut count = 0;
    while !bytes.is_empty() {
        let input = matrix(&mut bytes); let expected = matrix(&mut bytes);
        let edges = mk_array(input.into_iter().enumerate().map(|(i, row)| if i % 2 == 0 {
            Value::IntArray(row)
        } else { mk_array(row.into_iter().map(Value::Int).collect()) }).collect());
        let output = Purust_Dependencies_closureImpl(|_| panic!("unexpected fallback"), edges);
        let actual: Vec<Vec<i64>> = (0..output.array_len()).map(|i| {
            let row = output.array_get(i); (0..row.array_len()).map(|j| row.array_get_int(j)).collect()
        }).collect();
        assert_eq!(actual, expected); count += 1;
    }
    for bad in [-1, 1] {
        let output = Purust_Dependencies_closureImpl(|_| Value::Int(42), mk_array(vec![Value::IntArray(vec![bad])]));
        assert!(matches!(output, Value::Int(42)));
    }
    let output = Purust_Dependencies_closureImpl(|_| Value::Int(42), mk_array(vec![Value::IntArray(vec![]); 8193]));
    assert!(matches!(output, Value::Int(42)));
    println!("{count} native dependency graphs match independent reachability; bounds/fallback passed");
}
`);
  const binary = join(directory, 'checks');
  const build = spawnSync('rustc', ['--edition=2021', '-O', join(directory, 'main.rs'), '-o', binary], { encoding: 'utf8', timeout: 120000 });
  assert.equal(build.status, 0, build.error?.message ?? build.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 120000 });
  assert.equal(run.status, 0, run.error?.message ?? run.stderr);
  console.log(`${named.length} PureScript named graphs passed; ${run.stdout.trim()}`);
} finally { rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
