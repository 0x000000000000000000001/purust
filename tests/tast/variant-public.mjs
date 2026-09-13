// Real library sources; the successful suite covers 12 qualified contracts.
// The separate unvariant example deliberately remains a failing diagnostic.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { threadedRust } from '../../src/Purust/Threading.js';

const root=fileURLToPath(new URL('../../',import.meta.url)), fixtures=join(root,'tests/tast/fixtures/variant-public');
const source=resolve(root,'../purust-variant/src/Data/Variant.purs'), internal=resolve(root,'../purust-variant/src/Data/Variant/Internal.purs');
const packages=JSON.parse(readFileSync(join(root,'spago.lock'))).packages;
const native=new Set(['prelude','unsafe-coerce','effect','refs','partial','foldable-traversable','unfoldable','enums']);
const names=new Set();
function visitPackage(name) { if(names.has(name))return; assert.ok(packages[name],name); names.add(name); packages[name].dependencies.forEach(visitPackage); }
['control','lists','maybe','partial','record','type-equality','unsafe-coerce','refs','enums'].forEach(visitPackage);
const roots=[...names].map(name=>native.has(name)?resolve(root,`../purust-${name}/src`):join(root,`.spago/p/${name}-${packages[name].version}/src`));
roots.forEach(path=>assert.ok(existsSync(path),path));
const directory=mkdtempSync(join(process.env.PURUST_VARIANT_PUBLIC_KEEP_OUTPUT??tmpdir(),'purust-variant-public-'));
console.log(`Diagnostic: ${directory}`);
const report={complete:false,commands:[],modes:[],knownUnqualified:['unvariant/revariant']};
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const save=()=>writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');
function run(label,executable,args) {
  console.log(label);
  const r=spawnSync(executable,args,{cwd:directory,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024,
    env:{...process.env,CARGO_PROFILE_DEV_DEBUG:'0',CARGO_PROFILE_TEST_DEBUG:'0'}});
  writeFileSync(join(directory,`${label}.json`),JSON.stringify({command:executable,args,status:r.status,signal:r.signal,error:r.error?.message,stdout:r.stdout,stderr:r.stderr},null,2)+'\n');
  report.commands.push({label,status:r.status}); save(); assert.equal(r.status,0,`${label}: ${r.error??''}\n${r.stdout}\n${r.stderr}`); return r;
}
try {
  const purs=process.env.PURS??'purs';
  const graph=JSON.parse(run('graph',purs,['graph',source,internal,join(fixtures,'VariantPublicProbe.purs'),...roots.flatMap(path=>globSync('**/*.purs',{cwd:path}).map(file=>join(path,file)))]).stdout);
  const sources=new Map();
  function visit(name) {
    if(name==='Prim'||name.startsWith('Prim.')||sources.has(name))return;
    assert.ok(graph[name],name); assert.ok(!/^(Test|Util|Effect\.Aff|JS\.BigInt)(\.|$)/.test(name),name);
    sources.set(name,resolve(directory,graph[name].path)); graph[name].depends.forEach(visit);
  }
  visit('VariantPublicProbe'); assert.equal(sources.get('Data.Variant'),source); assert.equal(sources.get('Data.Variant.Internal'),internal);
  report.sources=[...sources].map(([module,path])=>({module,path,sha256:hash(path)}));
  const inputs=[...sources.values(),...[...sources.values()].flatMap(path=>['.js','.rs','.rs.cargo.json'].map(ext=>path.replace(/\.purs$/,ext)).filter(existsSync)),join(root,'spago.lock'),join(root,'bin/purust.js'),fileURLToPath(import.meta.url),
    ...['checks.rs','js-checks.mjs','unvariant.rs'].map(f=>join(fixtures,f))];
  report.inputs=[...new Set(inputs)].map(path=>({path,sha256:hash(path)}));
  report.purs={path:purs,version:run('purs-version',purs,['--version']).stdout.trim()};
  const tast=join(directory,'tast'); run('tast',purs,['compile',...sources.values(),'--codegen','corefn,js','--output',tast]); report.tast=tast;
  const t=JSON.parse(readFileSync(join(tast,'Data.Variant/corefn.json'))), probe=JSON.parse(readFileSync(join(tast,'VariantPublicProbe/corefn.json')));
  assert.deepEqual(t.foreign,[]); assert.deepEqual(t.dataDecls,[]);
  assert.deepEqual(t.classDecls.map(c=>c.name).sort(),['VariantBounded','VariantBoundedEnums','VariantEqs','VariantOrds','VariantShows']);
  assert.ok(probe.typeTable.some(x=>x.type==='Adt'&&x.fqn.join('.')==='Data.Variant.Variant'));
  const closed=probe.typeTable.find(x=>x.type==='Row'&&x.tail===null&&x.fields.map(f=>f.label).join(',')==='integer,text');
  assert.deepEqual(closed.fields.map(f=>probe.typeTable[f.type].type),['Int','String']);
  const open=probe.typeTable.find(x=>x.type==='Row'&&x.tail!==null&&x.fields.map(f=>f.label).join(',')==='integer');
  assert.equal(probe.typeTable[open.tail].type,'TypeVar');
  const applications=[];
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='TypeApp'&&Number.isInteger(node.typeArgument))applications.push(probe.typeTable[node.typeArgument]);Object.values(node).forEach(walk);}
  walk(probe.decls); assert.ok(applications.includes(closed)); assert.ok(applications.some(x=>x.type==='TypeLevelString'&&x.value==='integer')); assert.ok(applications.some(x=>x.type==='Int'));
  assert.match(run('reference',process.execPath,[join(fixtures,'js-checks.mjs'),tast]).stdout,/JS: 13 contract groups passed/);
  for(const mode of ['normal','threaded']) {
    const rust=join(directory,mode),cache=join(directory,'host-cache',mode);
    run(`generate-${mode}`,process.execPath,['--stack-size=65536',join(root,'bin/purust.js'),'--source',tast,'--out',rust,'--main','VariantPublicProbe',...(mode==='threaded'?['--threaded']:[])]);
    const cargo=['--offline','--manifest-path',join(rust,'Cargo.toml'),'--target-dir',cache,'-j','1'];
    run(`check-${mode}`,'cargo',['check',...cargo,'-p','Purs_VariantPublicProbe','--lib']);
    const code=readFileSync(join(rust,'Purs_Data_Variant/src/lib.rs'),'utf8');
    assert.doesNotMatch(code,/::Variant\b/); assert.match(code,/Record_type_kw_value/); assert.match(code,/\.get_type_kw\(\)/);
    assert.match(code,/pub struct VariantEqs\b/); assert.match(code,/pub struct VariantShows\b/);
    const tests=join(rust,'Purs_VariantPublicProbe/tests'); mkdirSync(tests);
    const adapt=s=>mode==='threaded'?threadedRust(s):s;
    writeFileSync(join(tests,'variant.rs'),adapt(readFileSync(join(fixtures,'checks.rs'),'utf8')));
    // Examples do not join cargo test --tests. This example is NOT an expected
    // panic: cargo test --example unvariant must stay red until a later fix.
    const examples=join(rust,'Purs_VariantPublicProbe/examples'); mkdirSync(examples);
    writeFileSync(join(examples,'unvariant.rs'),adapt(readFileSync(join(fixtures,'unvariant.rs'),'utf8')));
    const tested=run(`tests-${mode}`,'cargo',['test',...cargo,'--locked','-p','Purs_VariantPublicProbe','--tests','--','--test-threads=1']); assert.match(tested.stdout,/12 passed; 0 failed/);
    report.modes.push({mode,rust,tests:12,lockSha256:hash(join(rust,'Cargo.lock')),generated:globSync(['**/*.rs','**/*.toml'],{cwd:rust}).map(path=>({path,sha256:hash(join(rust,path))}))}); save();
  }
  for(const input of report.inputs)assert.equal(hash(input.path),input.sha256,input.path);
  report.complete=true; save(); console.log('Variant public: 12 qualified native contracts per mode; unvariant remains a separate unqualified example.');
} finally {
  if(!report.complete||process.env.PURUST_VARIANT_PUBLIC_KEEP_OUTPUT)console.log(`Retained diagnostic: ${directory}`);
  else rmSync(directory,{recursive:true});
}
