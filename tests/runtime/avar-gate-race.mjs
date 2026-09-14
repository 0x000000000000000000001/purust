// Bounded native AVar stress only: no Aff executor, database or production edits.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {codegenPrelude} from '../../output/Purust.CodeGen/index.js';
import {fromFoldable} from '../../output/Data.Set/index.js';
import {ordString} from '../../output/Data.Ord/index.js';
import {foldableArray} from '../../output/Data.Foldable/index.js';
import {threadedPrelude,threadedRust} from '../../src/Purust/Threading.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const mount=resolve(root,'../../b8x/run/bak');
const directory=mkdtempSync(join(mount,'rust/output/purust-avar-race-'));
const read=p=>readFileSync(resolve(root,p),'utf8');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const inputs=['../purust-avar/src/Effect/AVar.rs','tests/runtime/avar-gate-race.rs','tests/runtime/avar-gate-race.mjs',
 'src/Purust/Threading.js','src/Purust/RecordFields.js','output/Purust.CodeGen/index.js'].map(p=>{const path=resolve(root,p);return {path,sha256:hash(path)};});
const report={complete:false,directory,inputs,mode:'Arc Linux native AVar, no Aff/DB',timeoutSeconds:90};
const save=()=>writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2));save();console.log(directory);
const prelude=codegenPrelude(fromFoldable(foldableArray)(ordString)(['empty,filled,just,killed,left,nothing,right']));
const diagnostics=`
pub fn diagnostic(value:&Value)->String {
    let avar=avar_unbox(value); let Ok(state)=avar.state.try_lock() else {return "state locked".into();};
    format!("draining={} reads={} puts={} takes={} full={} error={}",state.draining,state.reads.len(),state.puts.len(),state.takes.len(),state.value.is_some(),state.error.is_some())
}`;
writeFileSync(join(directory,'main.rs'),`${threadedPrelude(prelude)}
extern crate self as purust_core;
mod perceus_ptr { ${read('tests/runtime/perceus_ptr/src/lib.rs').replace('mod local;',`mod local { ${read('tests/runtime/perceus_ptr/src/local.rs')} }`).replace('mod threaded;',`mod threaded { ${read('tests/runtime/perceus_ptr/src/threaded.rs')} }`)} }
mod avar { use super::*; ${threadedRust(read('../purust-avar/src/Effect/AVar.rs'))} ${diagnostics} }
${read('tests/runtime/avar-gate-race.rs')}`);
writeFileSync(join(directory,'Cargo.toml'),'[package]\nname="avar_gate_race"\nversion="0.0.0"\nedition="2021"\n[[bin]]\nname="avar_gate_race"\npath="main.rs"\n[features]\nthreaded=[]\n');
const args=['exec','-w','/var/www/b8x/run/bak/'+relative(mount,directory),'-e','CARGO_BUILD_JOBS=1','-e','CARGO_PROFILE_DEV_DEBUG=0',
 '-e','CARGO_INCREMENTAL=0','core-api-cli-1','timeout','-k','2s','90s','cargo','run','--offline','--quiet','--features','threaded'];
const start=Date.now();const result=spawnSync('docker',args,{encoding:'utf8',timeout:95000,maxBuffer:8*1024*1024});
writeFileSync(join(directory,'execute.json'),JSON.stringify({args,status:result.status,stdout:result.stdout,stderr:result.stderr,error:result.error?.message},null,2));
report.status=result.status;report.elapsedMs=Date.now()-start;report.stdout=result.stdout;report.stderr=result.stderr;
report.changedInputs=inputs.filter(p=>hash(p.path)!==p.sha256).map(p=>p.path);
report.complete=result.status===0 && result.stdout.includes('AVAR_GATE_RACE_PASS') && !report.changedInputs.length;save();
console.log(result.stdout);assert.ok(report.complete,`AVar stress failed: ${result.stderr}; report=${join(directory,'report.json')}`);
