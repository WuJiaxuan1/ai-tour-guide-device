import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createKnowledgeTools} from '../integrations/xiaozhi/knowledge-tools.mjs';
const tools=createKnowledgeTools();
test('knowledge tools work without a trip, HTTP server or model key',()=>{
 const list=tools.call('list_qixia_attractions');assert.equal(list.attractions.length,29);assert.equal(list.requiresPairing,false);
 const a=tools.call('qixia_trip_ask',{question:'介绍彩虹明镜'});assert.equal(a.unknown,false);assert.match(a.reply,/明镜/);assert.equal(a.tripAvailable,false);assert.equal(a.locationAvailable,false);assert.ok(a.sources.length);
 assert.match(tools.call('qixia_trip_ask',{question:'介绍这里',place_id:'pagoda'}).reply,/石/);
 assert.match(tools.call('qixia_trip_ask',{question:'千佛崖卫生间在哪'}).reply,/卫生间/);
 assert.equal(tools.call('qixia_trip_ask',{question:'千佛崖卫生间在哪'}).sources.some(p=>p.id==='buddha'),false);
});
test('unknown/live facts are qualified and snapshot evidence retains dates and warnings',()=>{
 for(const question of ['今天门票多少钱','明镜湖今天开放吗','观光车末班几点','现在红叶红了吗','我现在的GPS位置是什么','总统是谁']){
  const a=tools.call('qixia_trip_ask',{question});assert.equal(a.unknown,true,question);assert.deepEqual(a.sources,[]);
 }
 const a=tools.call('qixia_trip_ask',{question:'附近有哪些酒店'});assert.match(a.reply,/2026-10-27/);assert.match(a.reply,/不保证当前/);assert.ok(a.sources.every(p=>Array.isArray(p.warnings)));
});
test('tool arguments are checked',()=>{
 for(const args of [{},{question:''},{question:3},{question:'x'.repeat(2001)},{question:'介绍',place_id:'missing'},{question:'介绍',token:'secret'}])assert.throws(()=>tools.call('qixia_trip_ask',args));
 assert.throws(()=>tools.call('unknown',{}));
});
test('real stdio initialize/list/call and invalid requests preserve JSON-RPC',async()=>{
 const child=spawn(process.execPath,[fileURLToPath(new URL('../integrations/xiaozhi/knowledge-stdio.mjs',import.meta.url))],{stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
 const requests=[{id:1,method:'initialize'},{method:'notifications/initialized'},{id:2,method:'tools/list'},{id:3,method:'tools/call',params:{name:'qixia_trip_ask',arguments:{question:'千佛岩的历史'}}},{id:4,method:'tools/call',params:{name:'missing'}},{id:5,method:'ping'}];
 const exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('child failed')));});
 child.stdin.end(requests.map(r=>JSON.stringify({jsonrpc:'2.0',...r})).join('\n')+'\n');await exit;
 const r=out.trim().split('\n').map(JSON.parse);assert.equal(r.length,5);assert.equal(r[0].result.serverInfo.name,'qixia-local-knowledge');assert.equal(r[1].result.tools.length,2);assert.equal(JSON.parse(r[2].result.content[0].text).unknown,false);assert.equal(r[3].result.isError,true);assert.deepEqual(r[4].result,{});assert.match(err,/tool_call/);
});
