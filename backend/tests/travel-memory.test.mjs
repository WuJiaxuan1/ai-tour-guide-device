import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deflateSync} from 'node:zlib';
import {TravelStore} from '../src/travel/store.mjs';
import {createMemoryService,memoryFacts,explicitInterest} from '../src/travel/memory.mjs';
import {inspectTransparentPNG} from '../src/travel/png.mjs';
const crc=bytes=>{let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);}return(c^0xffffffff)>>>0;};
function png(transparent=true){const chunk=(type,data)=>{const bytes=Buffer.concat([Buffer.from(type),data]),out=Buffer.alloc(bytes.length+8);out.writeUInt32BE(data.length);bytes.copy(out,4);out.writeUInt32BE(crc(bytes),out.length-4);return out;};const header=Buffer.alloc(13);header.writeUInt32BE(3);header.writeUInt32BE(3,4);header[8]=8;header[9]=6;const raw=Buffer.alloc(39);for(let y=0;y<3;y++)for(let x=0;x<3;x++){raw[y*13+1+x*4]=200;raw[y*13+4+x*4]=!transparent||(x===1&&y===1)?255:0;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
function setup(){let now=Date.parse('2026-10-31T01:00:00Z');const store=new TravelStore(':memory:',{clock:()=>now}),session=store.authenticate(store.createSession().token),root=mkdtempSync(join(tmpdir(),'qixia-memory-'));const trip=store.createTrip(session,{client_event_id:'create'},()=>({status:'completed',started_at:'2026-10-31T00:00:00Z',ended_at:'2026-10-31T01:00:00Z',paused_ms:600000,paused_at:null,route:{route_id:'test',name:'测试路线',stops:[{stop_id:'s1',attraction_id:'palace',name:'行宫',status:'visited'},{stop_id:'s2',attraction_id:'lake',name:'湖',status:'pending'}]},visits:[{stop_id:'s1',attraction_id:'palace'},{stop_id:'s3',attraction_id:'palace'},{stop_id:'gate',attraction_id:'gate'}],notes:[],media:[]}));return{store,session,trip,root,cleanup:()=>{store.close();rmSync(root,{recursive:true,force:true});}};}
test('summary uses actual visits, preserves incomplete stops and durations, and job retry is idempotent',async()=>{
 const f=setup();let calls=0;const memory=createMemoryService({...f,scenicIds:new Set(['palace','lake']),config:()=>({}),model:{configured:()=>true,generate:async({context})=>{calls++;assert.equal(context.facts.confirmed_attraction_count,1);return{text:'游览行宫一处，湖未确认到访。',model:'test'};}}});
 try{const facts=memoryFacts(f.trip,[],new Set(['palace','lake']));assert.equal(facts.elapsed_seconds,3600);assert.equal(facts.active_seconds,3000);assert.deepEqual(facts.unconfirmed_stops,['湖']);const input={kind:'memory_summary',client_event_id:'summary'};const job=memory.generate(f.session,f.trip.id,input);memory.generate(f.session,f.trip.id,input);await memory.drain();assert.equal(calls,1);assert.equal(memory.get(f.session,f.trip.id,job.id).status,'succeeded');assert.throws(()=>memory.get(f.store.authenticate(f.store.createSession().token),f.trip.id,job.id),{code:'NOT_FOUND'});assert.throws(()=>memory.generate(f.session,f.trip.id,{kind:'sticker',client_event_id:'no-api'}),{code:'IMAGE_UNCONFIGURED'});}finally{await memory.close();f.cleanup();}
});
test('photo jobs reject fake transparency and download two real provider files under owner auth',async()=>{
 const f=setup();let good=false;const memory=createMemoryService({...f,scenicIds:new Set(),config:()=>({imageEndpoint:'https://images.example.test/generate'}),model:{configured:()=>false},fetcher:async()=>new Response(JSON.stringify({memory_card:{mime_type:'image/png',image_base64:png(false).toString('base64')},transparent_stickers:{mime_type:'image/png',image_base64:png(good).toString('base64')}}),{status:200})});
 try{assert.throws(()=>inspectTransparentPNG(png(false)),{code:'INVALID_TRANSPARENCY'});assert.equal(inspectTransparentPNG(png()).corner_alpha.length,4);const media=memory.upload(f.session,f.trip.id,png(),'image/png','palace');const input={kind:'sticker',media_id:media.media_id,client_event_id:'bad'};const bad=memory.generate(f.session,f.trip.id,input);await memory.drain();assert.equal(memory.get(f.session,f.trip.id,bad.id).status,'failed');good=true;const job=memory.generate(f.session,f.trip.id,{...input,client_event_id:'good'});await memory.drain();const done=memory.get(f.session,f.trip.id,job.id);assert.equal(done.status,'succeeded');assert.equal(done.result.assets.length,2);assert.deepEqual(memory.asset(f.session,f.trip.id,done.result.assets[1].asset_id).bytes,png());const foreign=f.store.authenticate(f.store.createSession().token);assert.throws(()=>memory.asset(foreign,f.trip.id,done.result.assets[1].asset_id),{code:'NOT_FOUND'});}finally{await memory.close();f.cleanup();}
});
test('graceful close waits for an in-flight generation before database closure',async()=>{
 const f=setup();let release;const blocked=new Promise(r=>{release=r;});const memory=createMemoryService({...f,scenicIds:new Set(),config:()=>({}),model:{configured:()=>true,generate:async()=>{await blocked;return{text:'摘要',model:'test'};}}});
 try{memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'close'});const work=memory.drain();let closed=false;const closing=memory.close().then(()=>{closed=true;});await Promise.resolve();assert.equal(closed,false);release();await closing;await work;assert.equal(memory.list(f.session,f.trip.id)[0].status,'succeeded');}finally{release();await memory.close();f.cleanup();}
});

test('memory separates visits, paused time, voice notes, web questions and immersive choices without guessing interests',()=>{
 const f=setup();try{
  const trip={...f.trip,notes:[{id:'voice-note',source:'device',text:'我最喜欢明镜湖'},{id:'web-note',source:'web',text:'我特别喜欢这里的安静'}],immersive_sessions:[{experience_id:'temple-ming-life',title:'山中一生',completed_at:'2026-10-31T00:30:00Z',choices:[{label:'安置书卷'}]}]};
  const facts=memoryFacts(trip,[{message_id:'question',channel:'web',status:'completed',question:'你觉得我最喜欢哪个景点？'},{message_id:'device',channel:'device',status:'completed',question:'我并不喜欢行宫'}],new Set(['palace','lake']));
  assert.equal(facts.confirmed_attraction_count,1);assert.equal(facts.paused_seconds,600);assert.equal(facts.active_seconds,3000);assert.deepEqual(facts.interaction_channels,{web:1,device:1});assert.deepEqual(facts.note_channels,{web:1,device:1});assert.equal(facts.interests.length,2);assert.equal(facts.interests[0].record_id,'voice-note');assert.deepEqual(facts.immersive_experiences[0].choices,['安置书卷']);assert.equal(facts.confirmed_attraction_names.includes('栖霞寺'),false);
  for(const text of ['我最喜欢哪个景点？','我不喜欢明镜湖','朋友说我最喜欢行宫','如果我最喜欢行宫呢','我以前最喜欢行宫','你最喜欢哪儿'])assert.equal(explicitInterest(text),false,text);
  assert.equal(explicitInterest('请记住这条旅行感受：我最喜欢明镜湖'),true);
  const paused=memoryFacts({...trip,ended_at:null,paused_ms:0,paused_at:'2026-10-31T00:30:00Z'},[],new Set(),Date.parse('2026-10-31T01:00:00Z'));assert.equal(paused.paused_seconds,1800);assert.equal(paused.active_seconds,1800);
 }finally{f.cleanup();}
});

test('summary snapshot survives new notes; concurrent clicks share work and failed jobs remain retryable',async()=>{
 const f=setup();let release,calls=0,input;const gate=new Promise(r=>release=r);
 const memory=createMemoryService({...f,scenicIds:new Set(['palace','lake']),config:()=>({}),model:{configured:()=>true,generate:async({context})=>{calls++;input=context;await gate;return{text:'一处景点，活动50分钟。',model:'test'};}}});
 try{
  const first=memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'first'});const work=memory.drain();
  const duplicate=memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'different-click'});assert.equal(duplicate.id,first.id);assert.equal(memory.list(f.session,f.trip.id).length,1);
  release();await work;let done=memory.list(f.session,f.trip.id)[0];assert.equal(done.summary_stale,false);assert.equal(calls,1);assert.ok(input.source_fingerprint);assert.deepEqual(done.result.notes,[]);
  f.store.mutate(f.session,f.trip.id,{client_event_id:'late-note'},t=>{t.notes.push({id:'note',text:'我最喜欢明镜湖',source:'device'});return[];});
  done=memory.list(f.session,f.trip.id)[0];assert.equal(done.summary_stale,true);assert.equal(done.result.facts.interests.length,0);assert.equal(memory.facts(f.session,f.trip.id).interests.length,1);
  const newer=memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'regenerate'});await memory.drain();assert.equal(memory.list(f.session,f.trip.id).find(j=>j.id===newer.id).summary_stale,false);assert.equal(memory.get(f.session,f.trip.id,newer.id).result.notes[0].id,'note');
 }finally{release();await memory.close();f.cleanup();}
});

test('failed summary exposes failure and a new request retries without inventing a result',async()=>{
 const f=setup();let fail=true;
 const memory=createMemoryService({...f,scenicIds:new Set(),config:()=>({}),model:{configured:()=>true,generate:async()=>{if(fail)throw Error('provider offline');return{text:'恢复后的摘要',model:'test'};}}});
 try{const bad=memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'bad-summary'});await memory.drain();assert.equal(memory.get(f.session,f.trip.id,bad.id).status,'failed');assert.equal(memory.get(f.session,f.trip.id,bad.id).result,undefined);fail=false;const good=memory.generate(f.session,f.trip.id,{kind:'memory_summary',client_event_id:'retry-summary'});await memory.drain();assert.equal(memory.get(f.session,f.trip.id,good.id).status,'succeeded');}finally{await memory.close();f.cleanup();}
});
