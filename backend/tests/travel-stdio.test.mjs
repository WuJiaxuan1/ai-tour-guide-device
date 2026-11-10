import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('MCP ping remains responsive while a model tool waits for its HTTP answer',async()=>{
 let received,release;const requested=new Promise(r=>received=r),block=new Promise(r=>release=r);
 const server=http.createServer(async(req,res)=>{for await(const chunk of req){}received();await block;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({reply:'下一站'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../integrations/xiaozhi/trip-stdio.mjs',import.meta.url))],{env:{...process.env,QIXIA_MCP_SECRET:'test-only',QIXIA_API_BASE:`http://127.0.0.1:${server.address().port}`},stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.resume();
 const send=v=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',...v})+'\n');
 try{send({id:1,method:'tools/call',params:{name:'qixia_trip_ask',arguments:{question:'下一站'}}});await requested;send({id:2,method:'ping'});const deadline=Date.now()+2000;while(!output.includes('"id":2')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.ok(output.includes('"id":2'));assert.equal(output.includes('"id":1'),false);release();}finally{release();child.kill();await new Promise(r=>server.close(r));}
});
