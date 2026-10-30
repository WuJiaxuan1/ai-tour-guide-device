import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {serveStatic} from '../src/static.mjs';
test('static delivery supports gzip, revalidation, immutable assets, audio ranges and empty files',async()=>{
 const base=resolve('.local-work');mkdirSync(base,{recursive:true});const root=mkdtempSync(resolve(base,'static-test-')),dir=resolve(root,'frontend/dist/client');mkdirSync(resolve(dir,'assets'),{recursive:true});
 writeFileSync(resolve(dir,'index.html'),'hello');writeFileSync(resolve(dir,'assets/test-abcdefgh.js'),'const x=1;'.repeat(300));writeFileSync(resolve(dir,'sample.wav'),'0123456789');writeFileSync(resolve(dir,'empty.txt'),'');
 const server=http.createServer((req,res)=>serveStatic(root,req,res,new URL(req.url,'http://localhost')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const js=await fetch(url+'/assets/test-abcdefgh.js');assert.equal(js.headers.get('content-encoding'),'gzip');assert.match(js.headers.get('cache-control'),/immutable/);assert.equal((await js.text()).length,3000);
  const cached=await fetch(url+'/assets/test-abcdefgh.js',{headers:{'if-none-match':js.headers.get('etag')}});assert.equal(cached.status,304);
  const plain=await fetch(url+'/assets/test-abcdefgh.js',{headers:{'accept-encoding':'gzip;q=0'}});assert.equal(plain.headers.get('content-encoding'),null);
  const head=await fetch(url+'/sample.wav',{method:'HEAD'});assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
  for(const [range,expected]of [['bytes=2-5','2345'],['bytes=-3','789'],['bytes=8-','89']]){const r=await fetch(url+'/sample.wav',{headers:{range}});assert.equal(r.status,206);assert.equal(await r.text(),expected);}
  assert.equal((await fetch(url+'/sample.wav',{headers:{range:'bytes=20-'}})).status,416);
  assert.equal(await(await fetch(url+'/empty.txt')).text(),'');assert.equal((await fetch(url+'/missing.png')).status,404);assert.equal(await(await fetch(url+'/route')).text(),'hello');
  assert.equal((await fetch(url+'/%2e%2e%5csecret.txt')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));rmSync(root,{recursive:true,force:true});}
});
