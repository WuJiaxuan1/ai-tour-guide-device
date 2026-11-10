// Read-only verification after a fresh clone + git lfs pull; no network or device access.
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p));
const json=p=>JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/,''));
const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const inventory=json('archive/workspace-20261101/source-inventory.json');
for(const row of inventory){
 const bytes=read(row.archived);
 if(hash(bytes)!==row.sha256){
  assert.ok(row.text_lf_sha256,`Binary hash mismatch: ${row.archived}`);
  const normalized=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/\r\n/g,'\n');
  assert.equal(hash(normalized),row.text_lf_sha256,`Text hash mismatch: ${row.archived}`);
 }
}
const report=json('stopwatch-nav/distributions/P9-cloud02/build-report.json');
for(const key of ['app','assets','restore_app','restore_assets']){
 const entry=report[key],bytes=read('stopwatch-nav/distributions/P9-cloud02/'+entry.filename);
 assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256);
}
const apk=json('stopwatch-nav/distributions/Android-overview01/checksums.json');
assert.equal(hash(read('stopwatch-nav/distributions/Android-overview01/'+apk.file)),apk.sha256);
assert.ok(!git('ls-files','--stage').split('\n').some(line=>line.startsWith('160000 ')),'Unexpected gitlink');
const lfsData=JSON.parse(git('lfs','ls-files','--json')),lfs=lfsData.files||lfsData;
for(const entry of lfs){
 const name=entry.name||entry.path;assert.ok(name,'Missing LFS path');
 assert.ok(existsSync(resolve(root,name)),`Missing LFS file: ${name}`);
 assert.equal(statSync(resolve(root,name)).size,entry.size,`LFS pointer or wrong size: ${name}`);
 assert.equal(hash(read(name)),entry.oid,`LFS SHA256 mismatch: ${name}`);
}
for(const name of ['PROJECT-STATE-20261101.md','AI-RESUME-PROMPT.md','PRIVATE-BACKUP-CHECKLIST.md','ARCHIVE-VERIFICATION-20261101.md'])assert.ok(existsSync(resolve(root,'docs/handoffs',name)));
console.log(JSON.stringify({status:'passed',commit:git('rev-parse','HEAD'),archivedSources:inventory.length,firmwareImages:4,androidApk:'verified',lfsPaths:lfs.length,uniqueLfsObjects:new Set(lfs.map(x=>x.oid)).size},null,2));
